package procedural

import (
	"math"
	"strings"
	"testing"
)

func TestRunwayGeometryDrawnARPThresholdAndHoming(t *testing.T) {
	s := preset("area")
	s.Environment.DrawnARP = true
	s.Environment.StationXNm, s.Environment.StationYNm = 7.5, -4.25
	for _, heading := range []float64{0, 90, 230, 359} {
		s.Environment.RunwayHeadingDeg = heading
		ux, uy := unit(heading)
		x, y := threshold(&s)
		cx, cy := runwayCentre(s.Environment)
		if math.Abs(cx-(7.5+uy*.15))+math.Abs(cy-(-4.25-ux*.15)) > 1e-9 || math.Abs(math.Hypot(x-cx, y-cy)-3/1.852/2) > 1e-9 {
			t.Fatal("runway must be a 3 km strip beside the drawn ARP", heading, x, y)
		}
		a := baseAircraft("test", "101", x-ux*5, y-uy*5, heading, 120, 1500)
		along, cross := runwayCoordinates(&s, &a)
		if math.Abs(along+5)+math.Abs(cross) > 1e-9 || !landingGeometry(&s, &a) {
			t.Fatal("five-mile final must be measured from the landing threshold", heading, along, cross)
		}
	}
	a := baseAircraft("test", "101", 7.5, -4.25+10, 180, 120, 1500)
	s.Aircraft = []Aircraft{a}
	s.Radio.AircraftID = a.ID
	h := Host{state: s}
	df := h.observeLocked("transmitting", 1000)
	if !df.Valid || *df.QTE != 0 || *df.QDM != 180 || !strings.Contains(positionReport(&s, &a), "distance 10.0 nautical miles") {
		t.Fatal("homing and reported range must still use the ARP", df)
	}
}

func TestRunwayGeometryPreservesPublishedAndLegacyPositions(t *testing.T) {
	e := defaults()
	e.ChartOrigin = &ChartOrigin{Latitude: 26, Longitude: 73}
	e.StationXNm, e.StationYNm = 8, 5 // Published station distinct from ARP.
	cx, cy := runwayCentre(e)
	if math.Abs(cx) > 1e-9 || math.Abs(cy+.15) > 1e-9 {
		t.Fatal("geographic ARP is chart origin, not the offset published station")
	}
	x, y := 0.0, 2.25
	e.RunwayCenterXNm, e.RunwayCenterYNm = &x, &y
	cx, cy = runwayCentre(e)
	if cx != 0 || cy != 2.25 || validateEnvironment(e) != nil {
		t.Fatal("explicit centre, including zero, must override the synthetic offset")
	}
	e.RunwayCenterYNm = nil
	if validateEnvironment(e) == nil {
		t.Fatal("partial centre must not silently change surveyed geometry")
	}
	legacy := State{Environment: Environment{RunwayHeadingDeg: 90, RunwayLengthNm: 1.5}}
	tx, ty := threshold(&legacy)
	if math.Abs(tx+.75)+math.Abs(ty) > 1e-9 {
		t.Fatal("saved zero-offset runway must retain its geometry")
	}
}
