package procedural

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"regexp"
	"strings"
)

var identifier = regexp.MustCompile(`^[A-Za-z0-9_-]{1,64}$`)
var imageIdentifier = regexp.MustCompile(`^[a-f0-9]{64}$`)

func decode(raw []byte, v any) error {
	if len(raw) == 0 {
		raw = []byte("{}")
	}
	if trimmed := bytes.TrimSpace(raw); len(trimmed) == 0 || trimmed[0] != '{' {
		return errors.New("payload must be a JSON object")
	}
	d := json.NewDecoder(bytes.NewReader(raw))
	d.DisallowUnknownFields()
	if e := d.Decode(v); e != nil {
		return fmt.Errorf("invalid payload: %w", e)
	}
	var trailing any
	if e := d.Decode(&trailing); e != io.EOF {
		return errors.New("payload must contain one JSON value")
	}
	return nil
}
func finite(n float64) bool        { return !math.IsNaN(n) && !math.IsInf(n, 0) }
func between(n, a, b float64) bool { return finite(n) && n >= a && n <= b }
func short(s string, n int) bool   { return len(s) <= n && !strings.ContainsRune(s, 0) }
func validID(s string) bool        { return identifier.MatchString(s) }
func normalize(n float64) float64 {
	n = math.Mod(n, 360)
	if n < 0 {
		n += 360
	}
	return n
}
func deltaHeading(from, to float64) float64 {
	v := normalize(to - from)
	if v > 180 {
		v -= 360
	}
	return v
}
func findAircraft(s *State, id string) *Aircraft {
	for i := range s.Aircraft {
		if s.Aircraft[i].ID == id {
			return &s.Aircraft[i]
		}
	}
	return nil
}
func findFix(s *State, id string) *Fix {
	for i := range s.Fixes {
		if s.Fixes[i].ID == id {
			return &s.Fixes[i]
		}
	}
	return nil
}
func findRoute(s *State, id string) *Route {
	for i := range s.Routes {
		if s.Routes[i].ID == id {
			return &s.Routes[i]
		}
	}
	return nil
}
func findArea(s *State, id string) *AirspaceArea {
	for i := range s.Areas {
		if s.Areas[i].ID == id {
			return &s.Areas[i]
		}
	}
	return nil
}
func validateEnvironment(e Environment) error {
	if !between(e.DFHoldSeconds, 2, 30) {
		return errors.New("D/F hold must be 2–30 seconds")
	}
	if e.TrainingMagneticVariationDeg != nil && !between(*e.TrainingMagneticVariationDeg, -180, 180) {
		return errors.New("training magnetic variation must be between -180 and 180 degrees")
	}
	if e.ChartOrigin != nil && (!between(e.ChartOrigin.Latitude, -85, 85) || !between(e.ChartOrigin.Longitude, -180, 180)) {
		return errors.New("chart origin must be latitude ±85 and longitude ±180 degrees")
	}
	if e.DrawnARP && e.ChartOrigin != nil {
		return errors.New("a mouse-drawn ARP uses local NM geometry, not geographic coordinates")
	}
	if strings.TrimSpace(e.StationName) == "" || !short(e.StationName, 40) || (e.StationType != "df" && e.StationType != "vor") || !between(e.StationXNm, -2000, 2000) || !between(e.StationYNm, -2000, 2000) || !short(e.StationFrequency, 20) || !short(e.AerodromeName, 100) || !short(e.ChartReference, 240) || !short(e.EffectiveInfo, 240) || !short(e.Briefing, 2000) {
		return errors.New("invalid station or aerodrome chart metadata")
	}
	if !between(e.QNHhPa, 870, 1085) {
		return errors.New("QNH must be between 870 and 1085 hPa")
	}
	if !between(e.TransitionAltitudeFt, 0, 30000) || e.TransitionAltitudeFt != math.Trunc(e.TransitionAltitudeFt) {
		return errors.New("transition altitude must be whole feet from 0 to 30000; 0 means unset")
	}
	if !between(e.TransitionLevel, 0, 600) || e.TransitionLevel != math.Trunc(e.TransitionLevel) {
		return errors.New("transition level must be a whole flight level from 0 to 600; 0 means unset")
	}
	if !between(e.ThresholdCrossingHeightFt, 0, 1000) {
		return errors.New("threshold crossing height must be between 0 and 1000 feet")
	}
	if !between(e.RangeNm, 1, 2000) || !between(e.MagneticVariationDeg, -180, 180) || !between(e.RunwayHeadingDeg, 0, 360) || !between(e.RunwayLengthNm, 0.3, 5) || !between(e.AerodromeElevationFt, -1500, 15000) || !between(e.WindDirectionDeg, 0, 360) || !between(e.WindSpeedKt, 0, 100) || !between(e.SeparationNm, 0.1, 200) || !between(e.SeparationFt, 100, 10000) || !between(e.SeparationMinutes, 0.1, 60) {
		return errors.New("environment values exceed training bounds")
	}
	m := e.Map
	if m.ImageID != "" && !imageIdentifier.MatchString(m.ImageID) {
		return errors.New("map imageId must be a SHA-256 image identifier")
	}
	if !between(m.WidthNm, 1, 2000) || !between(m.OriginXPct, 0, 100) || !between(m.OriginYPct, 0, 100) || !between(m.RotationDeg, -360, 360) || !between(m.Opacity, 0, 1) {
		return errors.New("invalid map calibration")
	}
	return nil
}
func validateFix(f Fix) error {
	if !validID(f.ID) || strings.TrimSpace(f.Name) == "" || !short(f.Name, 32) || !between(f.XNm, -2000, 2000) || !between(f.YNm, -2000, 2000) {
		return errors.New("fix needs a valid ID, name and coordinates within 2000 NM")
	}
	return nil
}
func validateRoute(s *State, r Route) error {
	if !short(r.Source, 100) || !short(r.Reference, 500) || !short(r.LevelLimits, 240) || !short(r.EffectiveInfo, 500) {
		return errors.New("route chart metadata is too long")
	}
	if !validID(r.ID) || strings.TrimSpace(r.Name) == "" || !short(r.Name, 64) || (r.Kind != "ats" && r.Kind != "conditional") || len(r.FixIDs) < 2 || len(r.FixIDs) > 50 || !between(r.AvailableFrom, 0, 604800) || !between(r.AvailableUntil, 0, 604800) || (r.AvailableUntil > 0 && r.AvailableUntil <= r.AvailableFrom) || !between(r.MinAltitudeFt, -1500, 60000) || !between(r.MaxAltitudeFt, -1500, 60000) || r.MaxAltitudeFt < r.MinAltitudeFt {
		return errors.New("invalid route name, kind, limits or time window")
	}
	for i, id := range r.FixIDs {
		if findFix(s, id) == nil {
			return fmt.Errorf("route fix %q does not exist", id)
		}
		if i > 0 && id == r.FixIDs[i-1] {
			return errors.New("route cannot contain consecutive identical fixes")
		}
	}
	return validateRouteChart(s, r)
}
func validateClearance(s *State, a *Aircraft, c Clearance, execution bool) error {
	// Stored armed instructions remain valid records after a condition changes.
	// At execution applyDue removes Condition and checks serviceability again.
	if a.CompassUnserviceable && (c.Condition == nil || !execution) && headingDirected(c) {
		return errors.New("heading instruction unavailable: compass unserviceable")
	}
	if c.Reference != "" && c.Reference != "qnh" && c.Reference != "standard" {
		return errors.New("altitude reference must be qnh or standard")
	}
	if c.Direction != "" && c.Direction != "left" && c.Direction != "right" {
		return errors.New("direction must be left or right")
	}
	if isGround(a) && c.Condition == nil {
		switch c.Action {
		case "heading", "continue-turn", "continue", "left", "right", "stop-turn", "direct", "route", "hold", "resume", "orbit-left", "orbit-right":
			return errors.New("airborne navigation clearance requires an airborne aircraft; use taxi, line-up and takeoff")
		}
	}
	if c.Condition != nil {
		if c.Condition.Kind == "time" {
			if !between(c.Condition.At, 0, 604800) || (!execution && c.Condition.At <= s.Elapsed) {
				return errors.New("clearance time must be in the future")
			}
		} else if c.Condition.Kind == "fix" {
			if findFix(s, c.Condition.FixID) == nil {
				return errors.New("condition fix does not exist")
			}
		} else {
			return errors.New("condition must be time or fix")
		}
	}
	value := func(lo, hi float64) error {
		if c.Value == nil || !between(*c.Value, lo, hi) {
			return fmt.Errorf("%s value must be between %g and %g", c.Action, lo, hi)
		}
		return nil
	}
	switch c.Action {
	case "heading":
		return value(0, 360)
	case "continue-turn":
		if c.Condition != nil {
			return errors.New("continue turn is an immediate instruction; use a conditional heading clearance instead")
		}
		if a.Mode != "heading" || a.ContinuousTurn || a.TurnDirection == "" || math.Abs(deltaHeading(a.HeadingDeg, a.TargetHeadingDeg)) < 1e-9 {
			return errors.New("continue turn requires an active heading-directed turn")
		}
		return value(0, 360)
	case "left", "right":
		if c.Value != nil {
			return value(0, 360)
		}
	case "altitude", "climb", "descend":
		var target float64
		if c.Reference == "standard" {
			if e := value(0, 600); e != nil {
				return e
			}
			target = flightLevelToMSL(*c.Value, s.Environment.QNHhPa)
			if !between(target, s.Environment.AerodromeElevationFt, 60000) {
				return errors.New("flight level converts outside allowed MSL altitude range")
			}
		} else {
			if e := value(s.Environment.AerodromeElevationFt, 60000); e != nil {
				return e
			}
			target = *c.Value
		}
		if c.Condition == nil || !execution {
			if c.Action == "climb" && target <= a.AltitudeFt {
				return errors.New("climb target must be above current altitude")
			}
			if c.Action == "descend" && target >= a.AltitudeFt {
				return errors.New("descent target must be below current altitude")
			}
		}
		return nil
	case "speed":
		return value(0, 700)
	case "direct":
		if findFix(s, c.FixID) == nil {
			return errors.New("direct fix does not exist")
		}
	case "route":
		r := findRoute(s, c.RouteID)
		if r == nil {
			return errors.New("route does not exist")
		}
		if c.Condition == nil && !routeAvailable(s, a, r) {
			return errors.New("unable route: not available at current time or altitude; continue current clearance")
		}
	case "hold":
		if findFix(s, c.FixID) == nil || !between(c.InboundCourseDeg, 0, 360) || !between(c.LegSeconds, 15, 300) {
			return errors.New("hold needs existing fix, inbound course and 15–300 second legs")
		}
	case "resume", "stop-turn", "continue", "stop", "orbit-left", "orbit-right":
	case "taxi", "line-up", "takeoff":
		if c.Condition != nil {
			break
		}
		if !isGround(a) {
			return errors.New("ground clearance requires an aircraft on the ground")
		}
		if c.Action == "takeoff" && (a.Mode != "line-up" || a.Status != "lined-up") {
			return errors.New("line up and wait at runway threshold before takeoff")
		}
		if c.Action == "line-up" && (a.Mode != "taxi" || a.Status != "holding-short") {
			return errors.New("taxi to holding point before line-up")
		}
	case "land":
		if c.Condition != nil {
			break
		}
		if isGround(a) || !landingGeometry(s, a) {
			return errors.New("landing requires an aligned final within 12 NM, ahead of threshold, and near the approach path")
		}
	case "go-around":
		if isGround(a) {
			return errors.New("go-around requires an airborne aircraft")
		}
	default:
		return errors.New("unsupported clearance action")
	}
	return nil
}
func validateAircraft(s *State, a Aircraft) error {
	if a.AltimeterReference != "qnh" && a.AltimeterReference != "standard" {
		return errors.New("aircraft altimeter reference must be qnh or standard")
	}
	if a.RouteIndex < 0 {
		return errors.New("route index cannot be negative")
	}
	if !validID(a.ID) || strings.TrimSpace(a.Callsign) == "" || !short(a.Callsign, 24) || !short(a.Type, 24) || !between(a.XNm, -2000, 2000) || !between(a.YNm, -2000, 2000) || !between(a.HeadingDeg, 0, 360) || !between(a.TargetHeadingDeg, 0, 360) || !between(a.SpeedKt, 0, 700) || !between(a.TargetSpeedKt, 0, 700) || !between(a.AltitudeFt, -1500, 60000) || !between(a.TargetAltitudeFt, -1500, 60000) || !between(a.VerticalRateFpm, 100, 10000) || !between(a.TurnRateDegSec, 0.1, 12) || !between(a.SpawnTime, 0, 604800) || !between(a.GroundTargetX, -2000, 2000) || !between(a.GroundTargetY, -2000, 2000) || !between(a.RunwayProgress, -5, 10) {
		return errors.New("aircraft contains invalid identifiers or motion limits")
	}
	switch a.Mode {
	case "heading", "route", "direct", "hold", "orbit", "taxi", "line-up", "takeoff", "landing", "go-around", "stopped", "ground":
	default:
		return errors.New("invalid aircraft mode")
	}
	switch a.Status {
	case "scheduled", "active", "holding", "blocked", "ground", "holding-short", "lined-up", "takeoff-roll", "landing", "landed", "stopped":
	default:
		return errors.New("invalid aircraft status")
	}
	if a.TurnDirection != "" && a.TurnDirection != "left" && a.TurnDirection != "right" {
		return errors.New("invalid turn direction")
	}
	if a.WakeCategory != "light" && a.WakeCategory != "medium" && a.WakeCategory != "heavy" && a.WakeCategory != "super" {
		return errors.New("invalid wake category")
	}
	if a.RouteID != "" {
		r := findRoute(s, a.RouteID)
		if r == nil || a.RouteIndex < 0 || a.RouteIndex > len(r.FixIDs) {
			return errors.New("aircraft route reference invalid")
		}
	} else if a.Mode == "route" {
		return errors.New("route mode requires a route")
	}
	if a.DirectFixID != "" && findFix(s, a.DirectFixID) == nil {
		return errors.New("direct fix missing")
	}
	if a.Mode == "direct" && a.DirectFixID == "" {
		return errors.New("direct mode requires fix")
	}
	if a.Hold != nil {
		v := a.Hold
		if findFix(s, v.FixID) == nil || !between(v.InboundCourseDeg, 0, 360) || !between(v.LegSeconds, 15, 300) || !between(v.PhaseElapsed, 0, 100000) || (v.Direction != "left" && v.Direction != "right") {
			return errors.New("invalid hold")
		}
		switch v.Phase {
		case "entry", "turn-outbound", "outbound", "turn-inbound", "inbound":
		default:
			return errors.New("invalid hold phase")
		}
		if v.ResumeMode != "route" && v.ResumeMode != "heading" && v.ResumeMode != "direct" {
			return errors.New("invalid hold resumption")
		}
		if v.ResumeRouteID != "" {
			r := findRoute(s, v.ResumeRouteID)
			if r == nil || v.ResumeRouteIndex < 0 || v.ResumeRouteIndex > len(r.FixIDs) {
				return errors.New("invalid hold route")
			}
		}
	}
	if a.Mode == "hold" && a.Hold == nil {
		return errors.New("hold mode requires hold state")
	}
	if a.Orbit != nil {
		o := a.Orbit
		if a.Mode != "orbit" || a.Hold != nil || a.RouteID != "" || a.DirectFixID != "" || a.ContinuousTurn || (o.Direction != "left" && o.Direction != "right") || a.TurnDirection != o.Direction || !between(o.EntryHeadingDeg, 0, 360) || !between(o.Degrees, 0, 360) || o.Degrees >= 360 || o.Laps < 0 || o.Laps > 100000 {
			return errors.New("invalid orbit state")
		}
	} else if a.Mode == "orbit" {
		return errors.New("orbit mode requires orbit state")
	}
	if len(a.PendingClearances) > 20 || len(a.LastFixTimes) > 200 {
		return errors.New("too many aircraft conditions or reports")
	}
	for _, c := range a.PendingClearances {
		if c.Condition == nil {
			return errors.New("pending clearance requires condition")
		}
		if e := validateClearance(s, &a, c, true); e != nil {
			return e
		}
	}
	for k, v := range a.LastFixTimes {
		if findFix(s, k) == nil || !between(v, 0, s.Elapsed) {
			return errors.New("invalid reported fix time")
		}
	}
	return nil
}
func validateCriterion(s *State, c Criterion) error {
	if !validID(c.ID) || findAircraft(s, c.AircraftA) == nil || findAircraft(s, c.AircraftB) == nil || c.AircraftA == c.AircraftB || !between(c.Minimum, 0, 60000) || !between(c.ExpiresAt, 0, 604800) || !short(c.Reference, 300) || !short(c.Applicability, 1000) || !short(c.Evidence, 1000) || !short(c.Assessment, 1000) || !short(c.Notes, 2000) {
		return errors.New("invalid separation worksheet pair or text")
	}
	switch c.Kind {
	case "vertical":
		if c.Unit != "ft" {
			return errors.New("vertical unit must be ft")
		}
	case "longitudinal-time", "approach", "wake":
		if c.Unit != "min" && c.Unit != "s" && c.Unit != "nm" {
			return errors.New("criterion unit must be s, min or nm")
		}
	case "longitudinal-distance", "lateral":
		if c.Unit != "nm" {
			return errors.New("distance unit must be nm")
		}
	case "runway":
		if c.Unit != "min" && c.Unit != "s" && c.Unit != "nm" && c.Unit != "manual" {
			return errors.New("invalid runway criterion unit")
		}
	default:
		return errors.New("unknown separation worksheet family")
	}
	return nil
}
func validateScopeDisplay(s *State, v ScopeDisplay) error {
	if len(v.HiddenRouteIDs) > 100 || len(v.HiddenAreaIDs) > 80 {
		return errors.New("scope selection exceeds chart capacity")
	}
	seen := map[string]bool{}
	for _, id := range v.HiddenRouteIDs {
		if seen[id] || findRoute(s, id) == nil {
			return errors.New("scope selection contains an unknown or duplicate route")
		}
		seen[id] = true
	}
	seen = map[string]bool{}
	for _, id := range v.HiddenAreaIDs {
		if seen[id] || findArea(s, id) == nil {
			return errors.New("scope selection contains an unknown or duplicate boundary")
		}
		seen[id] = true
	}
	return nil
}

func validateState(s *State) error {
	if s.Terminated && s.Running {
		return errors.New("terminated exercise cannot be running")
	}
	if !validID(s.ExerciseID) {
		return errors.New("scenario exercise identity is invalid")
	}
	// New static chart fields are optional in earlier version-one checkpoints.
	if s.Environment.DFHoldSeconds == 0 {
		s.Environment.DFHoldSeconds = 2
	}
	if s.Environment.MagneticVariationKnown != nil && !*s.Environment.MagneticVariationKnown && s.Environment.TrainingMagneticVariationDeg == nil {
		assumption := 0.0
		s.Environment.TrainingMagneticVariationDeg = &assumption
	}
	if s.Environment.StationName == "" {
		s.Environment.StationName = "NAV0"
	}
	if s.Environment.StationType == "" {
		s.Environment.StationType = "df"
	}
	if s.Sequence > 1_000_000_000_000 {
		return errors.New("scenario sequence exceeds supported range")
	}
	if s.Version != Version || !between(s.Elapsed, 0, 604800) || (s.Mode != "area" && s.Mode != "approach" && s.Mode != "aerodrome") || !short(s.Title, 100) || strings.TrimSpace(s.Title) == "" {
		return errors.New("unsupported or invalid scenario header")
	}
	if e := validateEnvironment(s.Environment); e != nil {
		return e
	}
	if e := validateScopeDisplay(s, s.ScopeDisplay); e != nil {
		return e
	}
	if len(s.Aircraft) > MaxAircraft || len(s.Fixes) > 200 || len(s.Routes) > 100 || len(s.Areas) > 80 || len(s.Events) > 500 || len(s.Calls) > 200 || len(s.Reports) > 500 || len(s.Criteria) > 100 {
		return errors.New("scenario exceeds bounded exercise capacity")
	}
	ids := map[string]bool{}
	for _, f := range s.Fixes {
		if e := validateFix(f); e != nil {
			return e
		}
		if ids[f.ID] {
			return errors.New("duplicate fix ID")
		}
		ids[f.ID] = true
	}
	ids = map[string]bool{}
	for _, r := range s.Routes {
		if e := validateRoute(s, r); e != nil {
			return e
		}
		if ids[r.ID] {
			return errors.New("duplicate route ID")
		}
		ids[r.ID] = true
	}
	ids = map[string]bool{}
	for _, a := range s.Areas {
		if e := validateArea(a); e != nil {
			return e
		}
		if ids[a.ID] {
			return errors.New("duplicate chart area ID")
		}
		ids[a.ID] = true
	}
	ids = map[string]bool{}
	callsigns := map[string]bool{}
	for _, a := range s.Aircraft {
		if e := validateAircraft(s, a); e != nil {
			return e
		}
		if ids[a.ID] || callsigns[strings.ToUpper(a.Callsign)] {
			return errors.New("duplicate aircraft ID or callsign")
		}
		ids[a.ID] = true
		callsigns[strings.ToUpper(a.Callsign)] = true
	}
	for id, v := range s.Strips {
		if !ids[id] || !short(v.Estimate, 100) || !short(v.Clearance, 1000) || !short(v.Notes, 4000) {
			return errors.New("invalid manual strip")
		}
	}
	criteriaIDs := map[string]bool{}
	for _, c := range s.Criteria {
		if e := validateCriterion(s, c); e != nil {
			return e
		}
		if criteriaIDs[c.ID] {
			return errors.New("duplicate criterion ID")
		}
		criteriaIDs[c.ID] = true
	}
	for _, c := range s.Calls {
		if !validID(c.ID) || !short(c.Text, 2000) || !between(c.Elapsed, 0, s.Elapsed) || (c.Status != "pending" && c.Status != "handled") || !validID(c.AircraftID) {
			return errors.New("invalid controller-call record")
		}
	}
	historyIDs := map[string]bool{}
	for _, c := range s.Calls {
		if historyIDs[c.ID] {
			return errors.New("duplicate controller call ID")
		}
		historyIDs[c.ID] = true
	}
	historyIDs = map[string]bool{}
	for _, r := range s.Reports {
		if historyIDs[r.ID] {
			return errors.New("duplicate pilot report ID")
		}
		historyIDs[r.ID] = true
	}
	historyIDs = map[string]bool{}
	for _, e := range s.Events {
		if historyIDs[e.ID] {
			return errors.New("duplicate debrief event ID")
		}
		historyIDs[e.ID] = true
	}
	for _, r := range s.Reports {
		if !validID(r.ID) || !validID(r.AircraftID) || !short(r.Callsign, 24) || !short(r.Text, 2000) || !short(r.Source, 32) || !between(r.Elapsed, 0, s.Elapsed) {
			return errors.New("invalid pilot report")
		}
	}
	for _, e := range s.Events {
		if !validID(e.ID) || !short(e.Kind, 64) || !short(e.Text, 2000) || !between(e.Elapsed, 0, s.Elapsed) || len(e.Truth) > MaxAircraft {
			return errors.New("invalid debrief event")
		}
		for _, p := range e.Truth {
			if !validID(p.AircraftID) || !between(p.XNm, -2000, 2000) || !between(p.YNm, -2000, 2000) || !between(p.AltitudeFt, -1500, 60000) || !between(p.HeadingDeg, 0, 360) || !between(p.SpeedKt, 0, 700) {
				return errors.New("invalid debrief truth")
			}
		}
	}
	if s.Strips == nil {
		s.Strips = map[string]Strip{}
	}
	if s.Fixes == nil {
		s.Fixes = []Fix{}
	}
	if s.Routes == nil {
		s.Routes = []Route{}
	}
	if s.Areas == nil {
		s.Areas = []AirspaceArea{}
	}
	if s.Aircraft == nil {
		s.Aircraft = []Aircraft{}
	}
	if s.Calls == nil {
		s.Calls = []Call{}
	}
	if s.Reports == nil {
		s.Reports = []Report{}
	}
	if s.Events == nil {
		s.Events = []Event{}
	}
	if s.Criteria == nil {
		s.Criteria = []Criterion{}
	}
	return nil
}
