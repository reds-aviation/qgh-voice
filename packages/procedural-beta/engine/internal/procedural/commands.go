package procedural

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"slices"
	"strings"
)

type effect struct {
	Duration   float64
	Interrupt  bool
	ClearRadio bool
}

func commandExerciseID(id string) string {
	sum := sha256.Sum256([]byte(id))
	return "exercise-" + hex.EncodeToString(sum[:16])
}

func nextID(s *State, prefix string) string {
	for {
		s.Sequence++
		id := fmt.Sprintf("%s-%d", prefix, s.Sequence)
		used := false
		for _, v := range s.Events {
			used = used || v.ID == id
		}
		for _, v := range s.Reports {
			used = used || v.ID == id
		}
		for _, v := range s.Calls {
			used = used || v.ID == id
		}
		for _, v := range s.Criteria {
			used = used || v.ID == id
		}
		used = used || findAircraft(s, id) != nil || findFix(s, id) != nil || findRoute(s, id) != nil || findArea(s, id) != nil
		if !used {
			return id
		}
	}
}
func record(s *State, kind, text, aircraftID string) {
	e := Event{ID: nextID(s, "e"), Elapsed: s.Elapsed, Kind: kind, Text: text, AircraftID: aircraftID}
	if aircraftID != "" {
		if a := findAircraft(s, aircraftID); a != nil {
			e.Truth = []Truth{{a.ID, a.XNm, a.YNm, a.AltitudeFt, a.HeadingDeg, a.SpeedKt}}
		}
	}
	s.Events = append(s.Events, e)
	if len(s.Events) > 500 {
		s.Events = s.Events[len(s.Events)-500:]
	}
}
func emitPilot(s *State, a *Aircraft, text, source string) {
	r := Report{ID: nextID(s, "r"), AircraftID: a.ID, Callsign: a.Callsign, Text: text, Elapsed: s.Elapsed, Source: source}
	s.Reports = append(s.Reports, r)
	if len(s.Reports) > 500 {
		s.Reports = s.Reports[len(s.Reports)-500:]
	}
	s.Radio = RadioView{ID: r.ID, AircraftID: a.ID, Callsign: a.Callsign, Text: text, Phase: "idle"}
	record(s, "pilot-"+source, text, a.ID)
}
func positionReport(s *State, a *Aircraft) string {
	if isGround(a) {
		return fmt.Sprintf("%s, %s, on the ground.", a.Callsign, strings.ReplaceAll(a.Status, "-", " "))
	}
	dx, dy := a.XNm-s.Environment.StationXNm, a.YNm-s.Environment.StationYNm
	r := math.Hypot(dx, dy)
	if r < 0.001 {
		return fmt.Sprintf("%s, overhead station, %s.", a.Callsign, altitudeReport(s, a))
	}
	return fmt.Sprintf("%s, bearing from %s %03.0f true, distance %.1f nautical miles, %s.", a.Callsign, s.Environment.StationName, normalize(math.Round(bearing(dx, dy))), r, altitudeReport(s, a))
}

// A deliberately simple training conversion. No temperature/atmospheric model
// or operational pressure correction is implied by these exercise values.
func flightLevelToMSL(fl, qnh float64) float64 { return fl*100 - (1013.25-qnh)*27 }
func altitudeReport(s *State, a *Aircraft) string {
	if a.AltimeterReference == "standard" {
		return fmt.Sprintf("flight level %03.0f", (a.AltitudeFt+(1013.25-s.Environment.QNHhPa)*27)/100)
	}
	return fmt.Sprintf("altitude %.0f feet, QNH %.0f", a.AltitudeFt, s.Environment.QNHhPa)
}
func headingDirected(c Clearance) bool {
	return c.Action == "heading" || c.Action == "continue-turn" || ((c.Action == "left" || c.Action == "right") && c.Value != nil)
}
func clearanceText(s *State, a *Aircraft, c Clearance) string {
	text := ""
	v := 0.0
	if c.Value != nil {
		v = *c.Value
	}
	switch c.Action {
	case "heading":
		text = fmt.Sprintf("heading %03.0f", normalize(v))
		if c.Direction != "" {
			text = "turn " + c.Direction + " " + text
		}
	case "continue-turn":
		text = fmt.Sprintf("continuing %s heading %03.0f true", a.TurnDirection, normalize(v))
	case "continue":
		text = "wings level, continuing present heading"
	case "left", "right":
		text = "turning " + c.Action
		if c.Value != nil {
			text += fmt.Sprintf(" heading %03.0f", normalize(v))
		}
	case "stop-turn":
		text = fmt.Sprintf("stopping turn, heading %03.0f", math.Round(a.HeadingDeg))
		if a.CompassUnserviceable {
			text = "wings level"
		}
	case "altitude", "climb", "descend":
		target := v
		if c.Reference == "standard" {
			target = flightLevelToMSL(v, s.Environment.QNHhPa)
		}
		verb := "maintain"
		if target > a.AltitudeFt {
			verb = "climb to"
		} else if target < a.AltitudeFt {
			verb = "descend to"
		}
		if c.Reference == "standard" {
			text = fmt.Sprintf("%s flight level %03.0f", verb, v)
		} else {
			text = fmt.Sprintf("%s altitude %.0f feet, QNH %.0f", verb, v, s.Environment.QNHhPa)
		}
	case "speed":
		text = fmt.Sprintf("speed %.0f knots", v)
	case "direct":
		text = "direct " + findFix(s, c.FixID).Name
	case "route":
		text = "route " + findRoute(s, c.RouteID).Name
	case "hold":
		text = fmt.Sprintf("hold at %s, inbound course %03.0f, %s turns, %.0f second legs", findFix(s, c.FixID).Name, normalize(c.InboundCourseDeg), c.Direction, c.LegSeconds)
	case "resume":
		text = "leaving hold, resuming navigation"
		if a.Orbit != nil {
			text = "completing this orbit, then resuming the entry heading"
		}
	case "orbit-left", "orbit-right":
		text = "orbiting " + strings.TrimPrefix(c.Action, "orbit-")
	case "taxi":
		text = "taxi to runway holding point"
	case "line-up":
		text = "line up and wait"
	case "takeoff":
		text = "cleared for takeoff"
	case "land":
		text = "cleared to land"
	case "go-around":
		text = "going around"
	case "stop":
		text = "stopping exercise movement"
	}
	if c.Condition != nil {
		if c.Condition.Kind == "time" {
			text = fmt.Sprintf("at exercise time %s, %s", formatTime(c.Condition.At), text)
		} else {
			text = "at " + findFix(s, c.Condition.FixID).Name + ", " + text
		}
	}
	return a.Callsign + ", " + text + "."
}
func formatTime(n float64) string {
	v := int(n)
	return fmt.Sprintf("%02d:%02d:%02d", v/3600, (v/60)%60, v%60)
}
func applyClearance(s *State, a *Aircraft, c Clearance) error {
	if e := validateClearance(s, a, c, true); e != nil {
		return e
	}
	value := 0.0
	if c.Value != nil {
		value = *c.Value
	}
	cancelNav := func() {
		a.RouteID = ""
		a.RouteIndex = 0
		a.DirectFixID = ""
		a.Hold = nil
		a.Orbit = nil
		a.ContinuousTurn = false
	}
	switch c.Action {
	case "heading", "left", "right":
		cancelNav()
		a.Mode = "heading"
		a.Status = "active"
		a.TargetHeadingDeg = normalize(value)
		a.TurnDirection = c.Direction
		if c.Action != "heading" {
			a.TurnDirection = c.Action
			a.ContinuousTurn = c.Value == nil
		}
		if a.ContinuousTurn {
			a.TargetHeadingDeg = a.HeadingDeg
		}
	case "continue-turn":
		a.TargetHeadingDeg = normalize(value)
	case "stop-turn", "continue":
		cancelNav()
		a.Mode = "heading"
		a.TargetHeadingDeg = a.HeadingDeg
		a.TurnDirection = ""
	case "altitude", "climb", "descend":
		a.AltimeterReference = c.Reference
		if a.AltimeterReference == "" {
			a.AltimeterReference = "qnh"
		}
		a.TargetAltitudeFt = value
		if a.AltimeterReference == "standard" {
			a.TargetAltitudeFt = flightLevelToMSL(value, s.Environment.QNHhPa)
		}
	case "speed":
		a.TargetSpeedKt = value
	case "direct":
		cancelNav()
		a.Mode = "direct"
		a.Status = "active"
		a.DirectFixID = c.FixID
		a.TurnDirection = ""
	case "route":
		cancelNav()
		a.Mode = "route"
		a.Status = "active"
		a.RouteID = c.RouteID
		a.TurnDirection = ""
	case "hold":
		resumeMode := a.Mode
		resumeRouteID, resumeRouteIndex := a.RouteID, a.RouteIndex
		if a.Hold != nil {
			resumeMode = a.Hold.ResumeMode
			resumeRouteID, resumeRouteIndex = a.Hold.ResumeRouteID, a.Hold.ResumeRouteIndex
		}
		if resumeMode != "route" && resumeMode != "direct" {
			resumeMode = "heading"
		}
		a.Hold = &HoldState{FixID: c.FixID, InboundCourseDeg: normalize(c.InboundCourseDeg), Direction: c.Direction, LegSeconds: c.LegSeconds, Phase: "entry", ResumeMode: resumeMode, ResumeRouteID: resumeRouteID, ResumeRouteIndex: resumeRouteIndex}
		a.Mode = "hold"
		a.Orbit = nil
		a.Status = "holding"
		a.ContinuousTurn = false
		a.TurnDirection = ""
	case "resume":
		if a.Orbit != nil {
			a.Orbit.ExitRequested = true
			if a.Orbit.Degrees < 1e-9 {
				a.TargetHeadingDeg = a.Orbit.EntryHeadingDeg
				a.HeadingDeg = a.Orbit.EntryHeadingDeg
				a.Orbit = nil
				a.Mode = "heading"
				a.TurnDirection = ""
			}
			break
		}
		if a.Hold == nil {
			return errors.New("aircraft is not holding or orbiting")
		}
		h := a.Hold
		a.Mode = h.ResumeMode
		a.RouteID = h.ResumeRouteID
		a.RouteIndex = h.ResumeRouteIndex
		a.Hold = nil
		a.Status = "active"
		a.TurnDirection = ""
		a.ContinuousTurn = false
		a.TargetHeadingDeg = a.HeadingDeg
	case "orbit-left", "orbit-right":
		direction := strings.TrimPrefix(c.Action, "orbit-")
		if a.Orbit != nil && a.Orbit.Direction == direction {
			a.Orbit.ExitRequested = false
			break
		}
		cancelNav()
		a.Mode = "orbit"
		a.Status = "active"
		a.TurnDirection = direction
		a.TargetHeadingDeg = a.HeadingDeg
		a.Orbit = &OrbitState{Direction: direction, EntryHeadingDeg: a.HeadingDeg}
	case "taxi":
		cancelNav()
		a.Mode = "taxi"
		a.Status = "ground"
		a.TargetSpeedKt = 15
		a.TargetAltitudeFt = s.Environment.AerodromeElevationFt
		tx, ty := threshold(s)
		rx, ry := unit(s.Environment.RunwayHeadingDeg + 90)
		a.GroundTargetX = tx + rx*0.15
		a.GroundTargetY = ty + ry*0.15
	case "line-up":
		cancelNav()
		a.Mode = "line-up"
		a.Status = "ground"
		a.TargetSpeedKt = 10
		a.GroundTargetX, a.GroundTargetY = threshold(s)
	case "takeoff":
		cancelNav()
		a.Mode = "takeoff"
		a.Status = "takeoff-roll"
		a.TargetSpeedKt = 160
		if a.TargetAltitudeFt < s.Environment.AerodromeElevationFt+500 {
			a.TargetAltitudeFt = s.Environment.AerodromeElevationFt + 3000
		}
		a.TargetHeadingDeg = normalize(s.Environment.RunwayHeadingDeg)
		a.HeadingDeg = a.TargetHeadingDeg
		a.RunwayProgress = 0
	case "land":
		cancelNav()
		a.Mode = "landing"
		a.Status = "landing"
		a.TargetHeadingDeg = normalize(s.Environment.RunwayHeadingDeg)
		a.TargetSpeedKt = math.Min(a.TargetSpeedKt, 145)
	case "go-around":
		cancelNav()
		a.Mode = "go-around"
		a.Status = "active"
		a.TargetHeadingDeg = normalize(s.Environment.RunwayHeadingDeg)
		a.TargetSpeedKt = 180
		a.TargetAltitudeFt = s.Environment.AerodromeElevationFt + 3000
	case "stop":
		ground := isGround(a)
		a.TargetSpeedKt = 0
		a.SpeedKt = 0
		a.TargetAltitudeFt = a.AltitudeFt
		a.TargetHeadingDeg = a.HeadingDeg
		a.ContinuousTurn = false
		a.Mode = "stopped"
		a.Status = "stopped"
		a.Hold = nil
		a.Orbit = nil
		if ground {
			a.Mode = "ground"
			a.Status = "ground"
		}
	}
	if a.SpawnTime > s.Elapsed {
		a.Status = "scheduled"
	}
	return nil
}

func apply(s *State, c Command, role string) (effect, error) {
	efx := effect{}
	if role != "instructor" && role != "student" {
		return efx, errors.New("invalid role")
	}
	if role == "student" && c.Type != "strip" && c.Type != "controller-call" {
		return efx, errors.New("only the instructor can change the traffic exercise")
	}
	if s.Terminated && (c.Type == "clearance" || c.Type == "transmit") {
		return efx, errors.New("exercise ended; reopen it or create/import a new exercise before flying traffic")
	}
	target := func() (*Aircraft, error) {
		a := findAircraft(s, c.AircraftID)
		if a == nil {
			return nil, errors.New("aircraft does not exist")
		}
		if role == "student" && a.Status == "scheduled" {
			return nil, errors.New("aircraft has not entered the exercise")
		}
		return a, nil
	}
	switch c.Type {
	case "scenario-setup":
		incoming, e := setupScenario(s, c)
		if e != nil {
			return efx, e
		}
		*s = incoming
		efx.ClearRadio = true
	case "preset":
		var p struct {
			Mode string `json:"mode"`
		}
		if e := decode(c.Payload, &p); e != nil {
			return efx, e
		}
		if p.Mode != "area" && p.Mode != "approach" && p.Mode != "aerodrome" {
			return efx, errors.New("mode must be area, approach or aerodrome")
		}
		revision, sequence := s.Revision, s.Sequence
		*s = preset(p.Mode)
		s.ExerciseID = commandExerciseID(c.ID)
		s.Revision = revision
		s.Sequence = max(s.Sequence, sequence)
		efx.ClearRadio = true
	case "clock":
		var p struct {
			Action  string  `json:"action"`
			Seconds float64 `json:"seconds"`
		}
		if e := decode(c.Payload, &p); e != nil {
			return efx, e
		}
		switch p.Action {
		case "resume":
			if s.Terminated {
				return efx, errors.New("exercise ended; reopen it or create/import a new exercise before resuming")
			}
			if s.Elapsed >= 604800 {
				return efx, errors.New("exercise has reached its seven-day limit")
			}
			s.Running = true
		case "pause":
			s.Running = false
		case "step":
			if s.Terminated {
				return efx, errors.New("exercise ended; reopen it or create/import a new exercise before stepping")
			}
			if s.Running {
				return efx, errors.New("pause the exercise before stepping")
			}
			if !between(p.Seconds, 1, 600) {
				return efx, errors.New("step must be 1 to 600 seconds")
			}
			advance(s, p.Seconds)
		case "terminate":
			s.Running = false
			s.Terminated = true
			s.Radio = RadioView{Phase: "idle"}
			efx.ClearRadio = true
		case "reopen":
			if !s.Terminated {
				return efx, errors.New("only an ended exercise can be reopened")
			}
			s.Terminated = false
			s.Running = false
			s.Radio = RadioView{Phase: "idle"}
			efx.ClearRadio = true
		default:
			return efx, errors.New("unknown clock action")
		}
		if p.Action == "reopen" {
			record(s, "reopened-paused", "Ended exercise reopened paused; traffic and working records retained", "")
		} else {
			record(s, "clock-"+p.Action, "Exercise clock "+p.Action, "")
		}
	case "scope-display":
		v := s.ScopeDisplay
		if e := decode(c.Payload, &v); e != nil {
			return efx, e
		}
		if e := validateScopeDisplay(s, v); e != nil {
			return efx, e
		}
		s.ScopeDisplay = v
		record(s, "scope-display", "Shared scope chart selection updated", "")
	case "environment":
		v := s.Environment
		if e := decode(c.Payload, &v); e != nil {
			return efx, e
		}
		if e := validateEnvironment(v); e != nil {
			return efx, e
		}
		for i := range s.Aircraft {
			a := &s.Aircraft[i]
			if isGround(a) {
				a.AltitudeFt = v.AerodromeElevationFt
				if a.TargetAltitudeFt <= s.Environment.AerodromeElevationFt+1 {
					a.TargetAltitudeFt = v.AerodromeElevationFt
				}
			}
			if a.AltimeterReference == "standard" {
				a.TargetAltitudeFt += (v.QNHhPa - s.Environment.QNHhPa) * 27
			}
		}
		s.Environment = v
		record(s, "environment", "Exercise environment updated", "")
	case "fix-upsert":
		var f Fix
		if e := decode(c.Payload, &f); e != nil {
			return efx, e
		}
		if f.ID == "" {
			f.ID = nextID(s, "fix")
		}
		f.Name = strings.TrimSpace(f.Name)
		if e := validateFix(f); e != nil {
			return efx, e
		}
		if old := findFix(s, f.ID); old != nil {
			*old = f
		} else {
			if len(s.Fixes) >= 200 {
				return efx, errors.New("maximum 200 fixes")
			}
			s.Fixes = append(s.Fixes, f)
		}
		record(s, "fix", "Fix "+f.Name+" saved", "")
	case "fix-delete":
		var p struct {
			ID string `json:"id"`
		}
		if e := decode(c.Payload, &p); e != nil {
			return efx, e
		}
		if findFix(s, p.ID) == nil {
			return efx, errors.New("fix does not exist")
		}
		for _, r := range s.Routes {
			for _, f := range r.FixIDs {
				if f == p.ID {
					return efx, errors.New("fix is referenced by a route")
				}
			}
		}
		for _, a := range s.Aircraft {
			if a.DirectFixID == p.ID || (a.Hold != nil && a.Hold.FixID == p.ID) {
				return efx, errors.New("fix is referenced by an aircraft")
			}
			for _, cc := range a.PendingClearances {
				if cc.FixID == p.ID || (cc.Condition != nil && cc.Condition.FixID == p.ID) {
					return efx, errors.New("fix is referenced by an armed clearance")
				}
			}
		}
		for i, f := range s.Fixes {
			if f.ID == p.ID {
				s.Fixes = append(s.Fixes[:i], s.Fixes[i+1:]...)
				break
			}
		}
		for i := range s.Aircraft {
			delete(s.Aircraft[i].LastFixTimes, p.ID)
		}
		record(s, "fix-delete", "Fix removed", "")
	case "route-upsert":
		var r Route
		if e := decode(c.Payload, &r); e != nil {
			return efx, e
		}
		if r.ID == "" {
			r.ID = nextID(s, "route")
		}
		r.Name = strings.TrimSpace(r.Name)
		if e := validateRoute(s, r); e != nil {
			return efx, e
		}
		if old := findRoute(s, r.ID); old != nil {
			for _, a := range s.Aircraft {
				if a.RouteID == r.ID && a.RouteIndex > len(r.FixIDs) {
					return efx, errors.New("route edit invalidates active route index")
				}
			}
			*old = r
		} else {
			if len(s.Routes) >= 100 {
				return efx, errors.New("maximum 100 routes")
			}
			s.Routes = append(s.Routes, r)
		}
		record(s, "route", "Route "+r.Name+" saved", "")
	case "area-upsert":
		var a AirspaceArea
		if e := decode(c.Payload, &a); e != nil {
			return efx, e
		}
		if a.ID == "" {
			a.ID = nextID(s, "area")
		}
		a.Name = strings.TrimSpace(a.Name)
		// Accept the customary repeated closing point while storing a simple ring.
		if len(a.Points) > 3 && a.Points[0] == a.Points[len(a.Points)-1] {
			a.Points = a.Points[:len(a.Points)-1]
		}
		if e := validateArea(a); e != nil {
			return efx, e
		}
		if old := findArea(s, a.ID); old != nil {
			*old = a
		} else {
			if len(s.Areas) >= 80 {
				return efx, errors.New("maximum 80 chart areas")
			}
			s.Areas = append(s.Areas, a)
		}
		record(s, "chart-area", "Chart area "+a.Name+" saved; "+a.Reference, "")
	case "area-delete":
		var p struct {
			ID string `json:"id"`
		}
		if e := decode(c.Payload, &p); e != nil {
			return efx, e
		}
		found := false
		for i, a := range s.Areas {
			if a.ID == p.ID {
				s.Areas = append(s.Areas[:i], s.Areas[i+1:]...)
				found = true
				break
			}
		}
		if !found {
			return efx, errors.New("chart area does not exist")
		}
		record(s, "chart-area-deleted", "Chart area removed", "")
		s.ScopeDisplay.HiddenAreaIDs = slices.DeleteFunc(s.ScopeDisplay.HiddenAreaIDs, func(id string) bool { return id == p.ID })
	case "route-delete":
		var p struct {
			ID string `json:"id"`
		}
		if e := decode(c.Payload, &p); e != nil {
			return efx, e
		}
		if findRoute(s, p.ID) == nil {
			return efx, errors.New("route does not exist")
		}
		for _, a := range s.Aircraft {
			if a.RouteID == p.ID || (a.Hold != nil && a.Hold.ResumeRouteID == p.ID) {
				return efx, errors.New("route is assigned to an aircraft")
			}
			for _, cc := range a.PendingClearances {
				if cc.RouteID == p.ID {
					return efx, errors.New("route is referenced by an armed clearance")
				}
			}
		}
		for i, r := range s.Routes {
			if r.ID == p.ID {
				s.Routes = append(s.Routes[:i], s.Routes[i+1:]...)
				break
			}
		}
		record(s, "route-delete", "Route removed", "")
		s.ScopeDisplay.HiddenRouteIDs = slices.DeleteFunc(s.ScopeDisplay.HiddenRouteIDs, func(id string) bool { return id == p.ID })
	case "aircraft-add":
		if len(s.Aircraft) >= MaxAircraft {
			return efx, fmt.Errorf("maximum %d aircraft; remove an aircraft before adding another", MaxAircraft)
		}
		a, e := aircraftFromPayload(s, c.Payload, "")
		if e != nil {
			return efx, e
		}
		s.Aircraft = append(s.Aircraft, a)
		s.Strips[a.ID] = Strip{}
		record(s, "aircraft-created", a.Callsign+" created", a.ID)
	case "aircraft-remove":
		var p struct {
			ID string `json:"id"`
		}
		if e := decode(c.Payload, &p); e != nil {
			return efx, e
		}
		if p.ID == "" {
			p.ID = c.AircraftID
		}
		if findAircraft(s, p.ID) == nil {
			return efx, errors.New("aircraft does not exist")
		}
		record(s, "aircraft-removed", "Aircraft removed", p.ID)
		for i, a := range s.Aircraft {
			if a.ID == p.ID {
				s.Aircraft = append(s.Aircraft[:i], s.Aircraft[i+1:]...)
				break
			}
		}
		delete(s.Strips, p.ID)
		kept := s.Criteria[:0]
		for _, v := range s.Criteria {
			if v.AircraftA != p.ID && v.AircraftB != p.ID {
				kept = append(kept, v)
			}
		}
		s.Criteria = kept
		if s.Radio.AircraftID == p.ID {
			efx.ClearRadio = true
		}
	case "aircraft-condition":
		a, e := target()
		if e != nil {
			return efx, e
		}
		var p struct {
			CompassUnserviceable *bool    `json:"compassUnserviceable"`
			TurnRateDegSec       *float64 `json:"turnRateDegSec"`
			VerticalRateFpm      *float64 `json:"verticalRateFpm"`
		}
		if e = decode(c.Payload, &p); e != nil {
			return efx, e
		}
		if p.CompassUnserviceable == nil && p.TurnRateDegSec == nil && p.VerticalRateFpm == nil {
			return efx, errors.New("aircraft condition needs a compass condition or a training rate")
		}
		if p.CompassUnserviceable != nil {
			a.CompassUnserviceable = *p.CompassUnserviceable
		}
		if p.TurnRateDegSec != nil {
			a.TurnRateDegSec = *p.TurnRateDegSec
		}
		if p.VerticalRateFpm != nil {
			a.VerticalRateFpm = *p.VerticalRateFpm
		}
		if e = validateAircraft(s, *a); e != nil {
			return efx, e
		}
		record(s, "aircraft-condition", a.Callsign+" compass condition / training rates updated", a.ID)
	case "clearance":
		a, e := target()
		if e != nil {
			return efx, e
		}
		var p Clearance
		if e = decode(c.Payload, &p); e != nil {
			return efx, e
		}
		if p.Action == "hold" {
			if p.LegSeconds == 0 {
				p.LegSeconds = 60
			}
			if p.Direction == "" {
				p.Direction = "right"
			}
		}
		if e = validateClearance(s, a, p, false); e != nil {
			return efx, e
		}
		text := clearanceText(s, a, p)
		if p.Condition != nil {
			if len(a.PendingClearances) >= 20 {
				return efx, errors.New("maximum 20 armed clearances per aircraft")
			}
			a.PendingClearances = append(a.PendingClearances, p)
			record(s, "clearance-armed", text, a.ID)
		} else {
			if e = applyClearance(s, a, p); e != nil {
				return efx, e
			}
			record(s, "clearance", text, a.ID)
		}
		if a.Status != "scheduled" {
			emitPilot(s, a, text, "readback")
		}
	case "transmit":
		a, e := target()
		if e != nil {
			return efx, e
		}
		if a.Status == "scheduled" {
			return efx, errors.New("aircraft has not entered the exercise")
		}
		var p struct {
			Text            string  `json:"text"`
			DurationSeconds float64 `json:"durationSeconds"`
			Mode            string  `json:"mode"`
		}
		if e = decode(c.Payload, &p); e != nil {
			return efx, e
		}
		if !short(p.Text, 2000) || p.DurationSeconds < 0 || p.DurationSeconds > 120 || !finite(p.DurationSeconds) {
			return efx, errors.New("pilot text must be at most 2000 characters and duration at most 120 seconds")
		}
		if p.Mode != "" && strings.TrimSpace(p.Text) != "" {
			return efx, errors.New("use a report mode or custom pilot text, not both")
		}
		switch p.Mode {
		case "", "position":
		case "df":
			p.Text = a.Callsign + ", roger."
		case "heading":
			if a.CompassUnserviceable {
				return efx, errors.New("heading report unavailable: compass unserviceable")
			}
			p.Text = fmt.Sprintf("%s, heading %03.0f true.", a.Callsign, normalize(math.Round(a.HeadingDeg)))
		default:
			return efx, errors.New("transmission mode must be df, heading or position")
		}
		if strings.TrimSpace(p.Text) == "" {
			p.Text = positionReport(s, a)
		}
		efx.Duration = p.DurationSeconds
		emitPilot(s, a, p.Text, "manual")
	case "interrupt":
		var p struct{}
		if e := decode(c.Payload, &p); e != nil {
			return efx, e
		}
		efx.Interrupt = true
		record(s, "radio-interrupted", "Pilot transmission interrupted", "")
	case "strip":
		a, e := target()
		if e != nil {
			return efx, e
		}
		var p Strip
		if e = decode(c.Payload, &p); e != nil {
			return efx, e
		}
		if !short(p.Estimate, 100) || !short(p.Clearance, 1000) || !short(p.Notes, 4000) {
			return efx, errors.New("strip text is too long")
		}
		s.Strips[a.ID] = p
		record(s, "strip-saved", "Manual strip saved", a.ID)
	case "controller-call":
		a, e := target()
		if e != nil {
			return efx, e
		}
		var p struct {
			Text string `json:"text"`
		}
		if e = decode(c.Payload, &p); e != nil {
			return efx, e
		}
		p.Text = strings.TrimSpace(p.Text)
		if p.Text == "" || !short(p.Text, 2000) {
			return efx, errors.New("controller call needs 1–2000 characters")
		}
		if len(s.Calls) >= 200 {
			discard := -1
			for i, v := range s.Calls {
				if v.Status == "handled" {
					discard = i
					break
				}
			}
			if discard < 0 {
				return efx, errors.New("instructor must handle calls before more can be added")
			}
			s.Calls = append(s.Calls[:discard], s.Calls[discard+1:]...)
		}
		s.Calls = append(s.Calls, Call{ID: nextID(s, "call"), AircraftID: a.ID, Text: p.Text, Elapsed: s.Elapsed, Status: "pending"})
		record(s, "controller-call", p.Text, a.ID)
	case "call-handled":
		var p struct {
			ID string `json:"id"`
		}
		if e := decode(c.Payload, &p); e != nil {
			return efx, e
		}
		found := false
		for i := range s.Calls {
			if s.Calls[i].ID == p.ID {
				s.Calls[i].Status = "handled"
				found = true
				break
			}
		}
		if !found {
			return efx, errors.New("call does not exist")
		}
		record(s, "call-handled", "Controller call acknowledged", "")
	case "criterion-upsert":
		var p Criterion
		if e := decode(c.Payload, &p); e != nil {
			return efx, e
		}
		if p.ID == "" {
			p.ID = nextID(s, "criterion")
		}
		if e := validateCriterion(s, p); e != nil {
			return efx, e
		}
		found := false
		for i := range s.Criteria {
			if s.Criteria[i].ID == p.ID {
				s.Criteria[i] = p
				found = true
				break
			}
		}
		if !found {
			if len(s.Criteria) >= 100 {
				return efx, errors.New("maximum 100 separation objectives")
			}
			s.Criteria = append(s.Criteria, p)
		}
		record(s, "separation-worksheet", "Instructor updated "+p.Kind+" criterion; "+p.Reference, "")
	case "criterion-delete":
		var p struct {
			ID string `json:"id"`
		}
		if e := decode(c.Payload, &p); e != nil {
			return efx, e
		}
		found := false
		for i, v := range s.Criteria {
			if v.ID == p.ID {
				s.Criteria = append(s.Criteria[:i], s.Criteria[i+1:]...)
				found = true
				break
			}
		}
		if !found {
			return efx, errors.New("criterion does not exist")
		}
		record(s, "separation-worksheet", "Separation objective removed", "")
	case "import":
		var p struct {
			Scenario         json.RawMessage `json:"scenario"`
			ExpectedRevision *uint64         `json:"expectedRevision"`
		}
		if e := decode(c.Payload, &p); e != nil {
			return efx, e
		}
		// Submit holds the host lock through this comparison and persistence.
		// Chart preparation must not overwrite an action accepted after export.
		if p.ExpectedRevision != nil && *p.ExpectedRevision != s.Revision {
			return efx, errors.New("exercise changed while preparing the chart; load it again from the current exercise")
		}
		var wrapper struct {
			Version  int             `json:"version"`
			Scenario json.RawMessage `json:"scenario"`
		}
		var incoming State
		var shape map[string]json.RawMessage
		if e := json.Unmarshal(p.Scenario, &shape); e != nil {
			return efx, errors.New("invalid scenario export")
		}
		if _, ok := shape["scenario"]; ok {
			if e := decode(p.Scenario, &wrapper); e != nil {
				return efx, e
			}
			if wrapper.Version != Version {
				return efx, errors.New("unsupported export version")
			}
			if e := decode(wrapper.Scenario, &incoming); e != nil {
				return efx, e
			}
		} else {
			if e := decode(p.Scenario, &incoming); e != nil {
				return efx, e
			}
		}
		if incoming.ExerciseID == "" {
			incoming.ExerciseID = commandExerciseID(c.ID)
		}
		if e := validateState(&incoming); e != nil {
			return efx, e
		}
		incoming.Running = false
		incoming.Terminated = false
		incoming.ExerciseID = commandExerciseID(c.ID)
		incoming.Radio = RadioView{Phase: "idle"}
		incoming.Revision = s.Revision
		incoming.Sequence = max(incoming.Sequence, s.Sequence)
		*s = incoming
		record(s, "imported-paused", "Scenario imported and paused", "")
		efx.ClearRadio = true
	default:
		return efx, errors.New("unsupported procedural command")
	}
	return efx, nil
}
