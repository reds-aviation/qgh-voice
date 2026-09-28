package procedural

import (
	"fmt"
	"math"
)

func nextFixETA(s *State, a *Aircraft) (string, float64, bool) {
	var f *Fix
	if a.Mode == "route" {
		r := findRoute(s, a.RouteID)
		if r != nil && a.RouteIndex < len(r.FixIDs) && routeAvailable(s, a, r) {
			f = findFix(s, r.FixIDs[a.RouteIndex])
		}
	} else if a.Mode == "direct" {
		f = findFix(s, a.DirectFixID)
	}
	if f == nil || a.Status == "scheduled" || a.Status == "blocked" || a.SpeedKt < 1 {
		return "", 0, false
	}
	ux, uy := unit(bearing(f.XNm-a.XNm, f.YNm-a.YNm))
	wx, wy := unit(s.Environment.WindDirectionDeg + 180)
	groundSpeed := a.SpeedKt + s.Environment.WindSpeedKt*(ux*wx+uy*wy)
	if groundSpeed <= 0 {
		return "", 0, false
	}
	return f.ID, math.Hypot(f.XNm-a.XNm, f.YNm-a.YNm) / groundSpeed * 60, true
}
func commonLegDistance(s *State, a, b *Aircraft) (float64, bool) {
	if a.Mode != "route" || b.Mode != "route" || a.RouteID == "" || a.RouteID != b.RouteID || a.RouteIndex != b.RouteIndex || a.RouteIndex < 1 {
		return 0, false
	}
	r := findRoute(s, a.RouteID)
	if r == nil || a.RouteIndex >= len(r.FixIDs) {
		return 0, false
	}
	from, to := findFix(s, r.FixIDs[a.RouteIndex-1]), findFix(s, r.FixIDs[a.RouteIndex])
	if from == nil || to == nil {
		return 0, false
	}
	dx, dy := to.XNm-from.XNm, to.YNm-from.YNm
	length := math.Hypot(dx, dy)
	if length < 0.001 {
		return 0, false
	}
	ux, uy := dx/length, dy/length
	crossA := (a.XNm-from.XNm)*uy - (a.YNm-from.YNm)*ux
	crossB := (b.XNm-from.XNm)*uy - (b.YNm-from.YNm)*ux
	if math.Abs(crossA) > 0.5 || math.Abs(crossB) > 0.5 || math.Abs(deltaHeading(a.HeadingDeg, bearing(dx, dy))) > 10 || math.Abs(deltaHeading(b.HeadingDeg, bearing(dx, dy))) > 10 {
		return 0, false
	}
	return math.Abs((a.XNm-b.XNm)*ux + (a.YNm-b.YNm)*uy), true
}
func runwayOccupied(s *State, a *Aircraft) bool {
	if a.Status == "scheduled" {
		return false
	}
	along, cross := runwayCoordinates(s, a)
	return along >= -0.05 && along <= s.Environment.RunwayLengthNm+0.05 && math.Abs(cross) <= 0.08 && a.AltitudeFt <= s.Environment.AerodromeElevationFt+50
}
func eventSpacing(s *State, a, b *Aircraft) (float64, bool) {
	ta, tb := -1.0, -1.0
	for i := len(s.Events) - 1; i >= 0; i-- {
		e := s.Events[i]
		if e.Kind != "pilot-departure" && e.Kind != "pilot-arrival" {
			continue
		}
		if e.AircraftID == a.ID && ta < 0 {
			ta = e.Elapsed
		}
		if e.AircraftID == b.ID && tb < 0 {
			tb = e.Elapsed
		}
		if ta >= 0 && tb >= 0 {
			return math.Abs(ta - tb), true
		}
	}
	return 0, false
}
func alerts(s *State) []Alert {
	result := []Alert{}
	for i := range s.Aircraft {
		a := &s.Aircraft[i]
		if a.Status == "scheduled" {
			continue
		}
		for j := i + 1; j < len(s.Aircraft); j++ {
			b := &s.Aircraft[j]
			if b.Status == "scheduled" {
				continue
			}
			distance := math.Hypot(a.XNm-b.XNm, a.YNm-b.YNm)
			vertical := math.Abs(a.AltitudeFt - b.AltitudeFt)
			if !isGround(a) && !isGround(b) && distance < s.Environment.SeparationNm && vertical < s.Environment.SeparationFt {
				v, minimum := distance, s.Environment.SeparationNm
				result = append(result, Alert{ID: "proximity-" + a.ID + "-" + b.ID, Kind: "geometric-proximity", AircraftIDs: []string{a.ID, b.ID}, Text: fmt.Sprintf("%s / %s: %.1f NM horizontally and %.0f ft vertically; below configured exercise thresholds. This does not determine procedural separation compliance.", a.Callsign, b.Callsign, distance, vertical), Measured: &v, Threshold: &minimum, Unit: "nm"})
			}
			fa, etaA, oka := nextFixETA(s, a)
			fb, etaB, okb := nextFixETA(s, b)
			if oka && okb && fa == fb && vertical < s.Environment.SeparationFt && math.Abs(etaA-etaB) < s.Environment.SeparationMinutes {
				v, minimum := math.Abs(etaA-etaB), s.Environment.SeparationMinutes
				result = append(result, Alert{ID: "eta-" + a.ID + "-" + b.ID, Kind: "same-fix-estimate", AircraftIDs: []string{a.ID, b.ID}, Text: fmt.Sprintf("%s / %s: estimated %s passage %.1f min apart at current speed. Estimates are a training cue, not an established procedural separation method.", a.Callsign, b.Callsign, fa, v), Measured: &v, Threshold: &minimum, Unit: "min"})
			}
			if runwayOccupied(s, a) && runwayOccupied(s, b) {
				result = append(result, Alert{ID: "runway-" + a.ID + "-" + b.ID, Kind: "runway-occupancy", AircraftIDs: []string{a.ID, b.ID}, Text: a.Callsign + " / " + b.Callsign + ": simultaneous runway occupancy. Instructor review required."})
			}
		}
	}
	for _, c := range s.Criteria {
		a, b := findAircraft(s, c.AircraftA), findAircraft(s, c.AircraftB)
		if a == nil || b == nil {
			continue
		}
		v := Alert{ID: "criterion-" + c.ID, Kind: "instructor-assessment", AircraftIDs: []string{a.ID, b.ID}, CriterionID: c.ID, Unit: c.Unit, Text: "Instructor assessment required: " + c.Kind + ". Check applicability, source, supporting reports and evidence."}
		if c.ExpiresAt > 0 && s.Elapsed >= c.ExpiresAt {
			v.Kind = "criterion-expired"
			v.Text = "Separation objective expired; reassess the selected method and evidence."
			result = append(result, v)
			continue
		}
		measured, valid := 0.0, false
		if a.Status == "scheduled" || b.Status == "scheduled" {
			v.Kind = "insufficient-information"
			v.Text = "A paired aircraft has not entered the exercise; no current measurement is available."
			result = append(result, v)
			continue
		}
		switch c.Kind {
		case "vertical":
			measured = math.Abs(a.AltitudeFt - b.AltitudeFt)
			valid = true
		case "longitudinal-distance":
			measured, valid = commonLegDistance(s, a, b)
		case "longitudinal-time", "approach":
			if c.Unit == "nm" {
				measured, valid = commonLegDistance(s, a, b)
			} else {
				fa, ea, oka := nextFixETA(s, a)
				fb, eb, okb := nextFixETA(s, b)
				if oka && okb && fa == fb {
					measured = math.Abs(ea - eb)
					valid = true
					if c.Unit == "s" {
						measured *= 60
					}
				}
			}
		case "wake", "runway":
			if c.Unit == "min" || c.Unit == "s" {
				measured, valid = eventSpacing(s, a, b)
				if c.Unit == "min" {
					measured /= 60
				}
			}
		case "lateral":
			v.Text = "Lateral separation needs the selected route/protected-airspace method and evidence; point distance alone cannot establish it. Instructor assessment required."
		}
		if valid {
			minimum := c.Minimum
			v.Measured = &measured
			v.Threshold = &minimum
			v.Kind = "criterion-measurement"
			v.Text = fmt.Sprintf("%s: measured %.1f %s; configured exercise criterion %.1f %s. Applicability and procedural evidence still require instructor assessment.", c.Kind, measured, c.Unit, minimum, c.Unit)
			if measured < c.Minimum {
				v.Kind = "criterion-below-threshold"
				v.Text = fmt.Sprintf("%s: measured %.1f %s, below configured %.1f %s. Review the selected method and evidence; this is not a complete Doc 4444 finding.", c.Kind, measured, c.Unit, minimum, c.Unit)
			}
		} else if c.Kind != "lateral" && c.Unit != "manual" {
			v.Kind = "insufficient-information"
			v.Text = "Insufficient model information for " + c.Kind + ": common directed leg/fix or completed runway-event pair is required. Record instructor evidence and assessment."
		}
		result = append(result, v)
	}
	return result
}
