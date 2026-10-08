package procedural

import (
	"math"
	"testing"
)

func timingAircraft() Aircraft {
	return Aircraft{ID: "timing", Callsign: "TIMING", Mode: "heading", Status: "active",
		SpeedKt: 240, TargetSpeedKt: 240, TurnRateDegSec: 3,
		AltitudeFt: 10000, TargetAltitudeFt: 10000, VerticalRateFpm: 1200}
}

func timingNear(t *testing.T, actual, expected float64) {
	t.Helper()
	if math.Abs(actual-expected) > 1e-9 {
		t.Fatalf("got %.12f, want %.12f", actual, expected)
	}
}

func TestMotionTimingStraightWindAndClimb(t *testing.T) {
	a := timingAircraft()
	a.TargetAltitudeFt = 11000
	s := State{Aircraft: []Aircraft{a}}
	advance(&s, 60)
	timingNear(t, s.Elapsed, 60)
	timingNear(t, s.Aircraft[0].XNm, 0)
	timingNear(t, s.Aircraft[0].YNm, 4)
	timingNear(t, s.Aircraft[0].AltitudeFt, 11000)
	count := 0
	for _, report := range s.Reports {
		if report.Source == "level-report" {
			count++
			timingNear(t, report.Elapsed, 50)
		}
	}
	if count != 1 {
		t.Fatalf("target report count %d, want 1", count)
	}
	a = timingAircraft()
	s = State{Aircraft: []Aircraft{a}, Environment: Environment{WindDirectionDeg: 270, WindSpeedKt: 20}}
	advance(&s, 60)
	timingNear(t, s.Aircraft[0].XNm, 1.0/3)
	timingNear(t, s.Aircraft[0].YNm, 4)
}

func TestMotionTimingLevelReportSamplesItsActualReachingInstant(t *testing.T) {
	a := timingAircraft()
	a.TargetAltitudeFt = 10001
	s := State{Aircraft: []Aircraft{a}}
	advance(&s, .25)
	if len(s.Reports) != 1 {
		t.Fatalf("reports %d, want 1", len(s.Reports))
	}
	timingNear(t, s.Reports[0].Elapsed, .05)
	if len(s.Events) != 1 || len(s.Events[0].Truth) != 1 {
		t.Fatal("missing reached-level truth sample")
	}
	timingNear(t, s.Events[0].Elapsed, .05)
	timingNear(t, s.Events[0].Truth[0].YNm, 240.0*.05/3600)
}

func TestMotionTimingDirectedTurnsFollowExactArc(t *testing.T) {
	for _, direction := range []string{"left", "right"} {
		a := timingAircraft()
		a.TurnDirection = direction
		a.TargetHeadingDeg = 90
		if direction == "left" {
			a.TargetHeadingDeg = 270
		}
		s := State{Aircraft: []Aircraft{a}}
		advance(&s, 30)
		radius := 240.0 / 3600 / (3 * math.Pi / 180)
		x := radius
		if direction == "left" {
			x = -x
		}
		timingNear(t, s.Aircraft[0].XNm, x)
		timingNear(t, s.Aircraft[0].YNm, radius)
		timingNear(t, s.Aircraft[0].HeadingDeg, a.TargetHeadingDeg)
	}
}

func TestMotionTimingPartialTurnAndSpeedTarget(t *testing.T) {
	a := timingAircraft()
	a.TargetHeadingDeg, a.TurnDirection = 1, "right"
	s := State{Aircraft: []Aircraft{a}}
	advance(&s, 1)
	radius := 240.0 / 3600 / (3 * math.Pi / 180)
	angle := math.Pi / 180
	timingNear(t, s.Aircraft[0].XNm, radius*(1-math.Cos(angle))+240.0/3600*(2.0/3)*math.Sin(angle))
	timingNear(t, s.Aircraft[0].YNm, radius*math.Sin(angle)+240.0/3600*(2.0/3)*math.Cos(angle))
	a = timingAircraft()
	a.SpeedKt, a.TargetSpeedKt = 200, 250
	s = State{Aircraft: []Aircraft{a}}
	advance(&s, 10)
	timingNear(t, s.Aircraft[0].SpeedKt, 250)
	timingNear(t, s.Aircraft[0].YNm, 225.0*10/3600)
	advance(&s, 50)
	timingNear(t, s.Aircraft[0].YNm, (225.0*10+250.0*50)/3600)
}

func TestMotionTimingSubdivisionDoesNotChangeTurningAcceleration(t *testing.T) {
	a := timingAircraft()
	a.SpeedKt, a.TargetSpeedKt = 200, 250.4
	a.ContinuousTurn, a.TurnDirection = true, "right"
	whole := State{Aircraft: []Aircraft{a}}
	parts := State{Aircraft: []Aircraft{a}}
	advance(&whole, 30)
	for i := 0; i < 300; i++ {
		advance(&parts, .1)
	}
	timingNear(t, parts.Elapsed, whole.Elapsed)
	timingNear(t, parts.Aircraft[0].XNm, whole.Aircraft[0].XNm)
	timingNear(t, parts.Aircraft[0].YNm, whole.Aircraft[0].YNm)
	timingNear(t, parts.Aircraft[0].HeadingDeg, whole.Aircraft[0].HeadingDeg)
}

func TestMotionTimingLandingRetainsAirborneWindUntilTouchdown(t *testing.T) {
	a := timingAircraft()
	a.Mode, a.SpeedKt, a.TargetSpeedKt = "landing", 120, 120
	a.YNm, a.AltitudeFt = -3, 795
	s := State{Aircraft: []Aircraft{a}, Environment: Environment{RunwayLengthNm: 1, WindDirectionDeg: 270, WindSpeedKt: 20}}
	advance(&s, .25)
	timingNear(t, s.Aircraft[0].XNm, 20.0*.25/3600)
	timingNear(t, s.Aircraft[0].YNm, -3+120.0*.25/3600)
	a.Status, a.YNm, a.XNm = "landed", 0, 0
	s.Aircraft = []Aircraft{a}
	advance(&s, .25)
	timingNear(t, s.Aircraft[0].XNm, 0)
}

func TestMotionTimingLevelBoundaryPreservesValidCheckpointTruth(t *testing.T) {
	s := preset("area")
	a := &s.Aircraft[0]
	a.XNm, a.YNm, a.HeadingDeg, a.TargetHeadingDeg = 2000, 0, 90, 90
	a.SpeedKt, a.TargetSpeedKt, a.VerticalRateFpm = 240, 240, 1200
	a.AltitudeFt, a.TargetAltitudeFt = 10000, 10001
	a.Mode, a.Status = "heading", "active"
	a.Orbit, a.Hold = nil, nil
	advance(&s, .25)
	if a.Mode != "stopped" || a.Status != "stopped" {
		t.Fatal("aircraft not stopped at model boundary")
	}
	timingNear(t, a.XNm, 2000)
	if err := validateState(&s); err != nil {
		t.Fatalf("boundary event made checkpoint invalid: %v", err)
	}
	for _, event := range s.Events {
		for _, truth := range event.Truth {
			if math.Abs(truth.XNm) > 2000 || math.Abs(truth.YNm) > 2000 {
				t.Fatal("event retains unbounded truth")
			}
		}
	}
}

func TestMotionTimingHoldLegExpiryKeepsItsStraightRemainder(t *testing.T) {
	a := timingAircraft()
	a.Mode, a.HeadingDeg, a.TargetHeadingDeg = "hold", 180, 180
	a.Hold = &HoldState{FixID: "hold-fix", InboundCourseDeg: 0, Direction: "right", LegSeconds: 60, Phase: "outbound", PhaseElapsed: 59.9}
	s := State{Aircraft: []Aircraft{a}, Fixes: []Fix{{ID: "hold-fix", XNm: 0, YNm: 10}}}
	withLevel := clone(s)
	withLevel.Aircraft[0].TargetAltitudeFt++ // Adds an unrelated 0.05-second reaching boundary.
	advance(&s, .25)
	radius := 240.0 / 3600 / (3 * math.Pi / 180)
	angle := .45 * math.Pi / 180
	timingNear(t, s.Aircraft[0].HeadingDeg, 180.45)
	timingNear(t, s.Aircraft[0].XNm, radius*(math.Cos(angle)-1))
	timingNear(t, s.Aircraft[0].YNm, -240.0*.1/3600-radius*math.Sin(angle))
	timingNear(t, s.Aircraft[0].Hold.PhaseElapsed, .15)
	if s.Aircraft[0].Hold.Phase != "turn-inbound" {
		t.Fatal("hold did not change phase at leg expiry")
	}
	advance(&withLevel, .25)
	timingNear(t, withLevel.Aircraft[0].XNm, s.Aircraft[0].XNm)
	timingNear(t, withLevel.Aircraft[0].YNm, s.Aircraft[0].YNm)
}

func TestMotionTimingHoldTurnCompletionStartsLegAtItsActualInstant(t *testing.T) {
	a := timingAircraft()
	a.Mode, a.HeadingDeg = "hold", 179.7
	a.Hold = &HoldState{FixID: "hold-fix", InboundCourseDeg: 0, Direction: "right", LegSeconds: 60, Phase: "turn-outbound"}
	s := State{Aircraft: []Aircraft{a}, Fixes: []Fix{{ID: "hold-fix", XNm: 0, YNm: 10}}}
	advance(&s, .2)
	radius := 240.0 / 3600 / (3 * math.Pi / 180)
	angle := .3 * math.Pi / 180
	timingNear(t, s.Aircraft[0].XNm, radius*(1-math.Cos(angle)))
	timingNear(t, s.Aircraft[0].YNm, -radius*math.Sin(angle)-240.0*.1/3600)
	timingNear(t, s.Aircraft[0].Hold.PhaseElapsed, .1)
	if s.Aircraft[0].Hold.Phase != "outbound" {
		t.Fatal("hold leg did not begin at heading completion")
	}
}
