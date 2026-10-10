package procedural

import (
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"reflect"
	"strings"
)

func validateRouteChart(s *State, r Route) error {
	if r.ChartDirection != "" && r.ChartDirection != "forward" && r.ChartDirection != "both" {
		return errors.New("chart direction must be forward or both; omit it for unspecified legacy routes")
	}
	if !short(r.Designator, 32) || !short(r.PublishedLimitsHeading, 500) || !short(r.TrackDistance, 500) || !short(r.LateralLimits, 240) || !short(r.OddLevels, 80) || !short(r.EvenLevels, 80) || !short(r.Notes, 2000) {
		return errors.New("route source annotations are too long")
	}
	if r.CoordinateOrigin != nil || len(r.GeoPoints) > 0 {
		if r.CoordinateOrigin == nil || !validGeoPoint(*r.CoordinateOrigin) || len(r.GeoPoints) != len(r.FixIDs) {
			return errors.New("geographic route needs an ARP and one coordinate per ordered fix")
		}
		for i, geo := range r.GeoPoints {
			if !validGeoPoint(geo) {
				return errors.New("route latitude or longitude is invalid")
			}
			f := findFix(s, r.FixIDs[i])
			if f == nil {
				return errors.New("geographic route fix does not exist")
			}
			p := projectAreaCoordinate(geo, *r.CoordinateOrigin)
			if math.Hypot(p.XNm-f.XNm, p.YNm-f.YNm) > .01 {
				return errors.New("geographic route does not match its projected fixes and ARP")
			}
		}
	}
	if len(r.PublishedSegments) > 0 && len(r.PublishedSegments) != len(r.FixIDs)-1 {
		return errors.New("published route needs one source segment per ordered leg")
	}
	for i, leg := range r.PublishedSegments {
		if leg.SourceSequence < 0 || leg.SourceSequence > 1000000 || strings.TrimSpace(leg.From) == "" || strings.TrimSpace(leg.To) == "" || !short(leg.From, 32) || !short(leg.To, 32) || !short(leg.FromPublishedCoordinates, 80) || !short(leg.ToPublishedCoordinates, 80) || !short(leg.LevelLimits, 240) || !short(leg.PublishedLimitsHeading, 500) || !short(leg.TrackDistance, 500) || !short(leg.LateralLimits, 240) || !short(leg.OddLevels, 80) || !short(leg.EvenLevels, 80) || !short(leg.Source, 100) || !short(leg.Reference, 500) || !short(leg.EffectiveInfo, 500) || (leg.SHA256 != "" && !imageIdentifier.MatchString(leg.SHA256)) {
			return errors.New("invalid published route segment annotations")
		}
		if i > 0 && r.PublishedSegments[i-1].To != leg.From {
			return errors.New("published route source segments must be consecutive")
		}
	}
	return nil
}

func requireChartEditing(s *State) error {
	if s.Terminated {
		return errors.New("exercise ended; Reopen before changing airspace")
	}
	if s.Running {
		return errors.New("pause the exercise before changing airspace")
	}
	return nil
}

// Changes to source labels are harmless; changes to route availability, limits,
// ordered fixes or referenced fix positions would alter a current clearance.
func protectNavigation(before, after *State) error {
	routes, fixes := map[string]bool{}, map[string]bool{}
	reference := func(c Clearance) {
		if c.RouteID != "" {
			routes[c.RouteID] = true
		}
		if c.FixID != "" {
			fixes[c.FixID] = true
		}
		if c.Condition != nil && c.Condition.FixID != "" {
			fixes[c.Condition.FixID] = true
		}
	}
	for _, a := range before.Aircraft {
		if a.RouteID != "" {
			routes[a.RouteID] = true
		}
		if a.DirectFixID != "" {
			fixes[a.DirectFixID] = true
		}
		if a.Hold != nil {
			fixes[a.Hold.FixID] = true
			if a.Hold.ResumeRouteID != "" {
				routes[a.Hold.ResumeRouteID] = true
			}
		}
		for _, c := range a.PendingClearances {
			reference(c)
		}
		for id := range a.LastFixTimes {
			fixes[id] = true
		}
	}
	for id := range routes {
		old, next := findRoute(before, id), findRoute(after, id)
		if old == nil || next == nil || !reflect.DeepEqual(old.FixIDs, next.FixIDs) || old.Kind != next.Kind || old.Active != next.Active || old.AvailableFrom != next.AvailableFrom || old.AvailableUntil != next.AvailableUntil || old.MinAltitudeFt != next.MinAltitudeFt || old.MaxAltitudeFt != next.MaxAltitudeFt {
			return fmt.Errorf("route %s is referenced by traffic; retain its navigation unchanged or remove that assignment first", id)
		}
		for _, fixID := range old.FixIDs {
			fixes[fixID] = true
		}
	}
	for id := range fixes {
		old, next := findFix(before, id), findFix(after, id)
		if old == nil || next == nil || *old != *next {
			return fmt.Errorf("fix %s is referenced by traffic; retain it unchanged or remove that assignment first", id)
		}
	}
	return nil
}

func upsertRouteGeometry(s *State, raw json.RawMessage) error {
	if err := requireChartEditing(s); err != nil {
		return err
	}
	var p struct {
		Route
		Fixes []Fix `json:"fixes"`
	}
	if err := decode(raw, &p); err != nil {
		return err
	}
	if len(p.Fixes) < 2 || len(p.Fixes) > 50 {
		return errors.New("route needs 2–50 ordered fixes")
	}
	before := *s
	before.Fixes = append([]Fix(nil), s.Fixes...)
	before.Routes = append([]Route(nil), s.Routes...)
	if len(p.FixIDs) != 0 {
		return errors.New("geometry command derives fixIds from fixes; do not provide both")
	}
	p.FixIDs = make([]string, len(p.Fixes))
	seen := map[string]bool{}
	for i, f := range p.Fixes {
		if f.ID == "" {
			f.ID = nextID(s, "fix")
		}
		f.Name = strings.TrimSpace(f.Name)
		if err := validateFix(f); err != nil {
			return err
		}
		if seen[f.ID] {
			return errors.New("route geometry cannot repeat a fix ID")
		}
		seen[f.ID] = true
		if i > 0 && math.Hypot(f.XNm-p.Fixes[i-1].XNm, f.YNm-p.Fixes[i-1].YNm) < 1e-8 {
			return errors.New("route adjacent fixes must have distinct positions")
		}
		if old := findFix(s, f.ID); old != nil {
			*old = f
		} else {
			s.Fixes = append(s.Fixes, f)
		}
		p.FixIDs[i] = f.ID
	}
	if p.ID == "" {
		p.ID = nextID(s, "route")
	}
	p.Name = strings.TrimSpace(p.Name)
	if err := validateRoute(s, p.Route); err != nil {
		return err
	}
	if old := findRoute(s, p.ID); old != nil {
		*old = p.Route
	} else {
		s.Routes = append(s.Routes, p.Route)
	}
	if err := protectNavigation(&before, s); err != nil {
		return err
	}
	if len(s.Fixes) > 200 || len(s.Routes) > 100 {
		return errors.New("maximum 200 fixes / 100 routes")
	}
	record(s, "route", "Route "+p.Name+" and its geometry saved", "")
	return nil
}

var chartEnvironmentKeys = map[string]bool{
	"chartOrigin": true, "drawnARP": true, "rangeNm": true, "stationName": true, "stationType": true, "stationXNm": true, "stationYNm": true, "stationFrequency": true,
	"aerodromeName": true, "chartReference": true, "effectiveInfo": true, "briefing": true,
	"magneticVariationDeg": true, "magneticVariationKnown": true, "trainingMagneticVariationDeg": true, "map": true,
	"runwayHeadingDeg": true, "runwayLengthNm": true, "aerodromeElevationFt": true, "thresholdCrossingHeightFt": true,
}

func replaceAirspace(s *State, raw json.RawMessage) error {
	if err := requireChartEditing(s); err != nil {
		return err
	}
	var p struct {
		ExpectedRevision *uint64         `json:"expectedRevision"`
		Environment      json.RawMessage `json:"environment"`
		Fixes            []Fix           `json:"fixes"`
		Routes           []Route         `json:"routes"`
		Areas            []AirspaceArea  `json:"areas"`
		ScopeDisplay     *ScopeDisplay   `json:"scopeDisplay,omitempty"`
	}
	if err := decode(raw, &p); err != nil {
		return err
	}
	if p.ExpectedRevision == nil || *p.ExpectedRevision != s.Revision {
		return errors.New("airspace changed while editing; reload the current chart before replacing it")
	}
	if p.Fixes == nil || p.Routes == nil || p.Areas == nil {
		return errors.New("airspace replacement requires fixes, routes and areas arrays")
	}
	var fields map[string]json.RawMessage
	if len(p.Environment) == 0 || json.Unmarshal(p.Environment, &fields) != nil || fields == nil {
		return errors.New("airspace replacement requires a chart environment object")
	}
	for key := range fields {
		if !chartEnvironmentKeys[key] {
			return fmt.Errorf("%s is not a chart environment field", key)
		}
	}
	environment := s.Environment
	if err := decode(p.Environment, &environment); err != nil {
		return err
	}
	if err := validateEnvironment(environment); err != nil {
		return err
	}
	before := *s
	s.Environment, s.Fixes, s.Routes, s.Areas = environment, p.Fixes, p.Routes, p.Areas
	if err := protectNavigation(&before, s); err != nil {
		return err
	}
	if p.ScopeDisplay != nil {
		s.ScopeDisplay = *p.ScopeDisplay
	} else {
		keptRoutes, keptAreas := []string{}, []string{}
		for _, id := range s.ScopeDisplay.HiddenRouteIDs {
			if findRoute(s, id) != nil {
				keptRoutes = append(keptRoutes, id)
			}
		}
		for _, id := range s.ScopeDisplay.HiddenAreaIDs {
			if findArea(s, id) != nil {
				keptAreas = append(keptAreas, id)
			}
		}
		s.ScopeDisplay.HiddenRouteIDs, s.ScopeDisplay.HiddenAreaIDs = keptRoutes, keptAreas
	}
	// Do not reuse environment command side effects: aircraft altitude/targets,
	// clocks, current clearances and exercise identity are deliberately untouched.
	record(s, "airspace", "Airspace chart replaced; current traffic preserved", "")
	return nil
}
