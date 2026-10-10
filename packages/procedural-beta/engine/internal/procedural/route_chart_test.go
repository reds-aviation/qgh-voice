package procedural

import (
	"bytes"
	"encoding/json"
	"reflect"
	"strings"
	"testing"
)

func chartCommand(t *testing.T, h *Host, id, kind string, payload any, role string) error {
	t.Helper()
	raw, err := json.Marshal(payload)
	if err != nil {
		t.Fatal(err)
	}
	_, err = h.Submit(Command{ID: id, Type: kind, ExerciseID: h.state.ExerciseID, Payload: raw}, role)
	return err
}
func customGeometry() map[string]any {
	return map[string]any{"name": "TRAINING R1", "kind": "ats", "active": true, "chartDirection": "forward", "minAltitudeFt": 5000, "maxAltitudeFt": 14000, "levelLimits": "5000–14000 ft MSL", "fixes": []Fix{{Name: "ALPHA", XNm: 10, YNm: 10}, {Name: "BRAVO", XNm: 20, YNm: 15}}}
}
func chartReplacement(s State) map[string]any {
	return map[string]any{"expectedRevision": s.Revision, "environment": map[string]any{"stationName": "CHART"}, "fixes": s.Fixes, "routes": s.Routes, "areas": s.Areas}
}

func TestRouteGeometryAtomicAndInstructorPausedAuthority(t *testing.T) {
	h, _ := OpenBrowser(nil)
	before := checkpointForTest(t, h)
	p := customGeometry()
	p["chartDirection"] = "reverse"
	if err := chartCommand(t, h, "invalid-direction", "route-geometry-upsert", p, "instructor"); err == nil {
		t.Fatal("invalid direction accepted")
	}
	if !bytes.Equal(before, checkpointForTest(t, h)) {
		t.Fatal("failed geometry left partial fixes or receipts")
	}
	p = customGeometry()
	if err := chartCommand(t, h, "student-route", "route-geometry-upsert", p, "student"); err == nil {
		t.Fatal("student chart mutation accepted")
	}
	if err := chartCommand(t, h, "new-route", "route-geometry-upsert", p, "instructor"); err != nil {
		t.Fatal(err)
	}
	r := h.state.Routes[len(h.state.Routes)-1]
	if r.ChartDirection != "forward" || len(r.FixIDs) != 2 || findFix(&h.state, r.FixIDs[0]).Name != "ALPHA" {
		t.Fatal("route and named fixes not saved together")
	}
	for _, stage := range []string{"running", "ended"} {
		h.state.Running, h.state.Terminated = stage == "running", stage == "ended"
		if err := chartCommand(t, h, "guard-"+stage, "route-geometry-upsert", p, "instructor"); err == nil {
			t.Fatalf("%s accepted", stage)
		}
	}
}

func TestReferencedRouteGeometryAllowsChartLabelsButRejectsMovedFix(t *testing.T) {
	h, _ := OpenBrowser(nil)
	r := h.state.Routes[0]
	fixes := []Fix{}
	for _, id := range r.FixIDs {
		fixes = append(fixes, *findFix(&h.state, id))
	}
	p := map[string]any{"id": r.ID, "name": r.Name, "kind": r.Kind, "active": r.Active, "fixes": fixes, "minAltitudeFt": r.MinAltitudeFt, "maxAltitudeFt": r.MaxAltitudeFt, "chartDirection": "both", "levelLimits": "Reference only"}
	aircraft := append([]Aircraft(nil), h.state.Aircraft...)
	if err := chartCommand(t, h, "labels-only", "route-geometry-upsert", p, "instructor"); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(aircraft, h.state.Aircraft) {
		t.Fatal("chart annotation changed flight")
	}
	before := checkpointForTest(t, h)
	fixes[0].XNm += .1
	if err := chartCommand(t, h, "moved-fix", "route-geometry-upsert", p, "instructor"); err == nil || !strings.Contains(err.Error(), "referenced") {
		t.Fatalf("moving assigned fix accepted: %v", err)
	}
	if !bytes.Equal(before, checkpointForTest(t, h)) {
		t.Fatal("failed assigned geometry changed state")
	}
}

func TestAirspaceReplaceKeepsExerciseTrafficClocksAndOperationalSettings(t *testing.T) {
	h, _ := OpenBrowser(nil)
	h.state.Elapsed = 125
	h.state.Aircraft[0].LastFixTimes["CENTRE"] = 120
	before := h.state
	p := chartReplacement(h.state)
	p["environment"] = map[string]any{"stationName": "NEW CHART", "aerodromeElevationFt": 1000, "runwayHeadingDeg": 180}
	if err := chartCommand(t, h, "replace-chart", "airspace-replace", p, "instructor"); err != nil {
		t.Fatal(err)
	}
	if h.state.ExerciseID != before.ExerciseID || h.state.Elapsed != 125 || !reflect.DeepEqual(h.state.Aircraft, before.Aircraft) || !reflect.DeepEqual(h.state.Strips, before.Strips) || !reflect.DeepEqual(h.state.Calls, before.Calls) || !reflect.DeepEqual(h.state.Reports, before.Reports) || !reflect.DeepEqual(h.state.Criteria, before.Criteria) {
		t.Fatal("chart replacement reset current exercise")
	}
	if h.state.Environment.QNHhPa != before.Environment.QNHhPa || h.state.Environment.DFHoldSeconds != before.Environment.DFHoldSeconds || h.state.Environment.AerodromeElevationFt != 1000 {
		t.Fatal("chart-only whitelist not applied correctly")
	}
}

func TestAirspaceReplaceRejectsStaleOperationalAndReferencedNavigationAtomically(t *testing.T) {
	for _, failure := range []string{"stale", "qnh", "missing-route", "moved-fix", "armed-fix", "historical-fix", "missing-array", "student", "running", "ended"} {
		t.Run(failure, func(t *testing.T) {
			h, _ := OpenBrowser(nil)
			p := chartReplacement(h.state)
			role := "instructor"
			switch failure {
			case "stale":
				p["expectedRevision"] = h.state.Revision + 1
			case "qnh":
				p["environment"] = map[string]any{"qnhHpa": 1000}
			case "missing-route":
				p["routes"] = h.state.Routes[1:]
			case "moved-fix":
				f := append([]Fix(nil), h.state.Fixes...)
				f[0].XNm++
				p["fixes"] = f
			case "armed-fix":
				h.state.Aircraft[0].PendingClearances = []Clearance{{Action: "direct", FixID: "NORTHEAST", Condition: &Condition{Kind: "time", At: 300}}}
				p["fixes"] = h.state.Fixes[:len(h.state.Fixes)-1]
			case "historical-fix":
				h.state.Aircraft[0].LastFixTimes["NORTHEAST"] = 0
				p["fixes"] = h.state.Fixes[:len(h.state.Fixes)-1]
			case "missing-array":
				delete(p, "areas")
			case "student":
				role = "student"
			case "running":
				h.state.Running = true
			case "ended":
				h.state.Terminated = true
			}
			before := checkpointForTest(t, h)
			if err := chartCommand(t, h, "bad-chart", "airspace-replace", p, role); err == nil {
				t.Fatal("invalid chart accepted")
			}
			// A live host can advance wall time independently of a rejected request.
			if failure != "running" && !bytes.Equal(before, checkpointForTest(t, h)) {
				t.Fatal("rejected chart altered exercise or accepted journal")
			}
		})
	}
}

func TestRouteGeographicalAndPublishedMetadataSurvivesRecoveryAndStudentProjection(t *testing.T) {
	h, _ := OpenBrowser(nil)
	origin := ChartOrigin{Latitude: 26, Longitude: 73}
	geo := []ChartOrigin{{Latitude: 26, Longitude: 73}, {Latitude: 26.1, Longitude: 73.2}}
	fixes := []Fix{{ID: "geo1", Name: "G1"}, {ID: "geo2", Name: "G2"}}
	for i := range fixes {
		p := projectAreaCoordinate(geo[i], origin)
		fixes[i].XNm, fixes[i].YNm = p.XNm, p.YNm
	}
	p := customGeometry()
	p["fixes"] = fixes
	p["coordinateOrigin"] = origin
	p["geoPoints"] = geo
	p["publishedSegments"] = []PublishedRouteSegment{{SourceSequence: 10, From: "G1", To: "G2", LevelLimits: "FL 460 FL 270 Class D 2400 FT", OddLevels: "↑", EvenLevels: "↓", Reference: "https://example.test/aip", SHA256: strings.Repeat("a", 64)}}
	if err := chartCommand(t, h, "geo-route", "route-geometry-upsert", p, "instructor"); err != nil {
		t.Fatal(err)
	}
	r := h.state.Routes[len(h.state.Routes)-1]
	if r.MinAltitudeFt != 5000 || r.MaxAltitudeFt != 14000 {
		t.Fatal("published labels modified numeric route availability")
	}
	recovered, err := OpenBrowser(checkpointForTest(t, h))
	if err != nil {
		t.Fatal(err)
	}
	view := recovered.View("student").(StudentView)
	got := view.Routes[len(view.Routes)-1]
	if !reflect.DeepEqual(r, got) {
		t.Fatal("saved/source metadata lost in student chart projection")
	}
	bad := customGeometry()
	bad["fixes"] = fixes
	bad["coordinateOrigin"] = origin
	bad["geoPoints"] = []ChartOrigin{{Latitude: 26.5, Longitude: 73}, geo[1]}
	before := checkpointForTest(t, h)
	if err := chartCommand(t, h, "bad-geo", "route-geometry-upsert", bad, "instructor"); err == nil {
		t.Fatal("mismatched coordinates accepted")
	}
	if !bytes.Equal(before, checkpointForTest(t, h)) {
		t.Fatal("bad coordinates left partial geometry")
	}
}

func TestLegacyRouteRemainsUnspecifiedAndListedOrderNavigation(t *testing.T) {
	s := preset("area")
	if err := validateState(&s); err != nil {
		t.Fatal(err)
	}
	if s.Routes[0].ChartDirection != "" {
		t.Fatal("legacy route gained fabricated arrows")
	}
	before := s.Aircraft[0]
	s.Routes[0].ChartDirection = "both"
	if err := validateState(&s); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(before, s.Aircraft[0]) || s.Routes[0].FixIDs[0] != "WEST" {
		t.Fatal("chart direction altered ordered flight navigation")
	}
}

func TestMouseDrawnARPIsLocalDurableAndKeepsSourcedGeometry(t *testing.T) {
	h, _ := OpenBrowser(nil)
	origin := ChartOrigin{Latitude: 26, Longitude: 73}
	geo := []ChartOrigin{origin, {Latitude: 26.1, Longitude: 73.2}}
	fixes := []Fix{{ID: "arp-geo1", Name: "ARP-G1"}, {ID: "arp-geo2", Name: "ARP-G2"}}
	for i := range fixes {
		point := projectAreaCoordinate(geo[i], origin)
		fixes[i].XNm, fixes[i].YNm = point.XNm, point.YNm
	}
	route := customGeometry()
	route["fixes"], route["coordinateOrigin"], route["geoPoints"] = fixes, origin, geo
	if err := chartCommand(t, h, "sourced-before-arp", "route-geometry-upsert", route, "instructor"); err != nil {
		t.Fatal(err)
	}
	if err := chartCommand(t, h, "geo-before-arp", "environment", map[string]any{"chartOrigin": origin}, "instructor"); err != nil {
		t.Fatal(err)
	}
	before := h.state
	local := map[string]any{"drawnARP": true, "chartOrigin": nil, "stationName": "ARP", "stationType": "df", "stationXNm": 7.5, "stationYNm": -4.25}
	if err := chartCommand(t, h, "draw-arp", "environment", local, "instructor"); err != nil {
		t.Fatal(err)
	}
	if !h.state.Environment.DrawnARP || h.state.Environment.ChartOrigin != nil || h.state.Environment.StationXNm != 7.5 || h.state.Environment.StationYNm != -4.25 {
		t.Fatal("mouse-drawn ARP acquired geographic coordinates or lost its position")
	}
	if !reflect.DeepEqual(h.state.Routes, before.Routes) || !reflect.DeepEqual(h.state.Fixes, before.Fixes) || !reflect.DeepEqual(h.state.Aircraft, before.Aircraft) {
		t.Fatal("placing the local ARP altered sourced chart geometry or traffic")
	}
	recovered, err := OpenBrowser(checkpointForTest(t, h))
	if err != nil {
		t.Fatal(err)
	}
	student := recovered.View("student").(StudentView)
	if !student.Environment.DrawnARP || student.Environment.ChartOrigin != nil || student.Environment.StationXNm != 7.5 || student.Environment.StationYNm != -4.25 {
		t.Fatal("local ARP did not survive recovery and student projection")
	}
	p := chartReplacement(h.state)
	p["environment"] = map[string]any{"drawnARP": false, "chartOrigin": origin, "stationXNm": 0, "stationYNm": 0}
	if err := chartCommand(t, h, "load-geographic-chart", "airspace-replace", p, "instructor"); err != nil {
		t.Fatal(err)
	}
	if h.state.Environment.DrawnARP || h.state.Environment.ChartOrigin == nil {
		t.Fatal("loading a geographic chart inherited the local ARP marker")
	}
}

func TestMouseDrawnARPRejectsFabricatedGeographicOriginAtomically(t *testing.T) {
	h, _ := OpenBrowser(nil)
	before := checkpointForTest(t, h)
	for i, payload := range []map[string]any{
		{"drawnARP": true, "chartOrigin": ChartOrigin{Latitude: 26, Longitude: 73}},
		{"drawnARP": "true", "chartOrigin": nil},
	} {
		if err := chartCommand(t, h, "invalid-arp-"+string(rune('0'+i)), "environment", payload, "instructor"); err == nil {
			t.Fatal("invalid mouse-drawn ARP metadata accepted")
		}
		if !bytes.Equal(before, checkpointForTest(t, h)) {
			t.Fatal("rejected ARP altered the exercise")
		}
	}
}
