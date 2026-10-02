package procedural

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
)

// aircraftFromPayload is shared by individual traffic creation and atomic roster setup.
func aircraftFromPayload(s *State, raw json.RawMessage, fallbackID string) (Aircraft, error) {
	a := baseAircraft("", "", -20, 0, 90, 180, 5000)
	var p struct {
		Aircraft
		QTE   *float64 `json:"qteDeg,omitempty"`
		Range *float64 `json:"rangeNm,omitempty"`
	}
	p.Aircraft = a
	if e := decode(raw, &p); e != nil {
		return Aircraft{}, e
	}
	a = p.Aircraft
	var supplied map[string]json.RawMessage
	json.Unmarshal(raw, &supplied)
	if a.ID == "" {
		a.ID = fallbackID
		if a.ID == "" {
			a.ID = nextID(s, "a")
		}
	}
	a.Callsign = strings.ToUpper(strings.TrimSpace(a.Callsign))
	if _, suppliedCallsign := supplied["callsign"]; !suppliedCallsign {
		used := make(map[string]bool, len(s.Aircraft))
		for _, existing := range s.Aircraft {
			used[existing.Callsign] = true
		}
		for number := 101; ; number++ {
			a.Callsign = fmt.Sprint(number)
			if !used[a.Callsign] {
				break
			}
		}
	}
	if _, ok := supplied["headingDeg"]; ok {
		if _, set := supplied["targetHeadingDeg"]; !set {
			a.TargetHeadingDeg = a.HeadingDeg
		}
	}
	if _, ok := supplied["speedKt"]; ok {
		if _, set := supplied["targetSpeedKt"]; !set {
			a.TargetSpeedKt = a.SpeedKt
		}
	}
	if _, ok := supplied["altitudeFt"]; ok {
		if _, set := supplied["targetAltitudeFt"]; !set {
			a.TargetAltitudeFt = a.AltitudeFt
		}
	}
	if p.QTE != nil || p.Range != nil {
		if p.QTE == nil || p.Range == nil || !between(*p.QTE, 0, 360) || !between(*p.Range, 0, 2000) {
			return Aircraft{}, errors.New("polar spawn needs qteDeg 0–360 and rangeNm 0–2000")
		}
		if _, ok := supplied["xNm"]; ok {
			return Aircraft{}, errors.New("use coordinates or bearing/range, not both")
		}
		if _, ok := supplied["yNm"]; ok {
			return Aircraft{}, errors.New("use coordinates or bearing/range, not both")
		}
		ux, uy := unit(*p.QTE)
		a.XNm = s.Environment.StationXNm + ux**p.Range
		a.YNm = s.Environment.StationYNm + uy**p.Range
	}
	if a.SpawnTime > s.Elapsed {
		a.Status = "scheduled"
	}
	if a.RouteID != "" && a.Mode == "heading" {
		a.Mode = "route"
	}
	if a.AltitudeFt <= s.Environment.AerodromeElevationFt+1 && a.SpeedKt <= 30 && a.Mode == "heading" {
		a.Mode = "ground"
		a.Status = "ground"
		if a.SpawnTime > s.Elapsed {
			a.Status = "scheduled"
		}
	}
	if e := validateAircraft(s, a); e != nil {
		return Aircraft{}, e
	}
	for _, old := range s.Aircraft {
		if old.ID == a.ID || strings.EqualFold(old.Callsign, a.Callsign) {
			return Aircraft{}, errors.New("aircraft ID and callsign must be unique")
		}
	}
	return a, nil
}

// setupScenario preserves the configured chart while creating a new, paused
// exercise. It builds a private candidate so an invalid roster never publishes
// a partially replaced fleet or drops the previous controller's records.
func setupScenario(current *State, c Command) (State, error) {
	var p struct {
		Title       string            `json:"title"`
		Mode        string            `json:"mode"`
		Aircraft    []json.RawMessage `json:"aircraft"`
		Environment json.RawMessage   `json:"environment"`
	}
	if e := decode(c.Payload, &p); e != nil {
		return State{}, e
	}
	if p.Mode != "area" && p.Mode != "approach" && p.Mode != "aerodrome" {
		return State{}, errors.New("mode must be area, approach or aerodrome")
	}
	if len(p.Aircraft) < 1 || len(p.Aircraft) > MaxNewAircraft {
		return State{}, fmt.Errorf("scenario setup needs 1–%d aircraft", MaxNewAircraft)
	}
	s := clone(*current)
	s.ExerciseID = commandExerciseID(c.ID)
	s.Title = strings.TrimSpace(p.Title)
	if s.Title == "" {
		s.Title = "Instructor-led " + p.Mode + " exercise"
	}
	s.Mode, s.Elapsed, s.Running = p.Mode, 0, false
	s.Terminated = false
	s.Aircraft = []Aircraft{}
	s.Strips = map[string]Strip{}
	s.Calls, s.Reports, s.Events, s.Criteria = []Call{}, []Report{}, []Event{}, []Criterion{}
	s.Radio = RadioView{Phase: "idle"}
	if len(p.Environment) > 0 {
		if string(p.Environment) == "null" {
			return State{}, errors.New("environment must be a settings object")
		}
		if e := decode(p.Environment, &s.Environment); e != nil {
			return State{}, e
		}
	}
	for i, raw := range p.Aircraft {
		var supplied map[string]json.RawMessage
		if e := json.Unmarshal(raw, &supplied); e != nil {
			return State{}, fmt.Errorf("aircraft %d must be an initial traffic object", i+1)
		}
		for key := range supplied {
			switch key {
			case "id", "callsign", "type", "qteDeg", "rangeNm", "xNm", "yNm", "headingDeg", "altitudeFt", "speedKt", "turnRateDegSec", "verticalRateFpm", "compassUnserviceable", "spawnTime", "routeId", "wakeCategory":
			default:
				return State{}, fmt.Errorf("aircraft %d: %s is not an initial traffic field", i+1, key)
			}
		}
		a, e := aircraftFromPayload(&s, raw, fmt.Sprintf("ac%d", i+1))
		if e != nil {
			return State{}, fmt.Errorf("aircraft %d: %w", i+1, e)
		}
		s.Aircraft = append(s.Aircraft, a)
		s.Strips[a.ID] = Strip{}
	}
	record(&s, "exercise-created", fmt.Sprintf("Instructor configured %d aircraft", len(s.Aircraft)), "")
	if e := validateState(&s); e != nil {
		return State{}, e
	}
	return s, nil
}
