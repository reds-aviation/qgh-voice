/*
The contents of this file are subject to the Common Public Attribution License Version 1.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at https://opensource.org/license/cpal_1-0.
Software distributed under the License is distributed on an "AS IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License for the specific language governing rights and limitations under the License.
The Original Code is ATS SIM BOX. The Initial Developer is Balaram Reddy. All portions of the code written by Balaram Reddy are Copyright (c) 2026 Balaram Reddy. All Rights Reserved.
Contributor(s): None designated. No alternative licence is designated for this CPAL version. Historical MIT releases retain the permissions described in COPYRIGHT.md.
*/

package procedural

import (
	"bytes"
	"encoding/json"
	"reflect"
	"strings"
	"testing"
)

func fixturePublishedChart(t *testing.T) *PublishedAirspace {
	t.Helper()
	var chart PublishedAirspace
	// Browser-normalized fields include sourceIndex 0 and a fix on both axes.
	err := decode([]byte(`{"schemaVersion":1,"baseId":"pune","baseName":"PUNE","lfaId":"lfa","lfaName":"Training LFA","selectionId":"test-lfa","source":"Synthetic test source","effectiveInfo":"2026-10-25","status":"test-fixture","origin":{"latitude":18.58,"longitude":73.91},"sources":[{"source":"Synthetic test source","effectiveInfo":"2026-10-25"}],"layerVisibility":{"lfa":true,"arp":true,"runways":true,"atsRoutes":false},"areas":[{"id":"lfa","name":"Training LFA","kind":"restricted","points":[{"xNm":0,"yNm":0},{"xNm":10,"yNm":0},{"xNm":10,"yNm":10}],"sourceIndex":0,"floorLabel":"GND","ceilingLabel":"FL 325"}],"routes":[{"id":"route","name":"A1","points":[{"xNm":0,"yNm":0},{"xNm":10,"yNm":0}],"sourceIndex":0,"levelLimits":"FL260/FL460"}],"runways":[{"id":"10/28","name":"10/28","points":[{"xNm":-0.5,"yNm":0},{"xNm":0.5,"yNm":0}],"widthNm":0.025,"sourceIndex":0}],"fixes":[{"id":"axis","name":"AXIS","xNm":0,"yNm":0}],"referenceBoundaries":[],"gaps":["Synthetic fixture only; no operational data."]}`), &chart)
	if err != nil {
		t.Fatal(err)
	}
	return &chart
}

func fixtureReferenceBoundary() ReferenceBoundary {
	return ReferenceBoundary{ID: "test:line.1", Name: "Synthetic reference line", Kind: "OTHER", Label: "TEST",
		Geometry:     BoundaryGeometry{Type: "MultiLineString", Coordinates: [][][]float64{{{73, 18}, {73.1, 18.1}}}},
		Source:       BoundarySource{Authority: "Test authority", Title: "Synthetic test fixture", Section: "Testing", URL: "https://example.test/source", CRS: "EPSG:4326", CoordinateOrder: "longitude-latitude", EffectiveDate: "2026-10-25"},
		Verification: BoundaryVerification{Status: "verified", VerifiedBy: "Test fixture", VerifiedAt: "2026-10-25", ApprovalReference: "TEST-ONLY"}}
}

func TestPublishedChartRoundTripAndAirspaceReplacementPreserveFlightState(t *testing.T) {
	h, _ := OpenBrowser(nil)
	h.state.Elapsed = 125
	heading := 180.0
	h.state.Aircraft[0].PendingClearances = []Clearance{{Action: "heading", Value: &heading, Direction: "right", Condition: &Condition{Kind: "time", At: 300}}}
	before := clone(h.state)
	chart := fixturePublishedChart(t)
	empty := ""
	chart.Areas[0].Notes = &empty
	boundaries := []ReferenceBoundary{fixtureReferenceBoundary()}
	chart.ReferenceBoundaries = boundaries
	payload := chartReplacement(h.state)
	payload["environment"] = map[string]any{"chartOrigin": ChartOrigin{Latitude: 18.58, Longitude: 73.91}, "publishedAirspace": chart, "referenceBoundaries": boundaries}
	if err := chartCommand(t, h, "published-chart", "airspace-replace", payload, "instructor"); err != nil {
		t.Fatal(err)
	}
	if h.state.ExerciseID != before.ExerciseID || h.state.Elapsed != before.Elapsed || !reflect.DeepEqual(h.state.Aircraft, before.Aircraft) || !reflect.DeepEqual(h.state.Strips, before.Strips) || !reflect.DeepEqual(h.state.Calls, before.Calls) || !reflect.DeepEqual(h.state.Reports, before.Reports) {
		t.Fatal("reference chart replaced exercise traffic, time, clearances or records")
	}
	if h.state.Environment.RunwayHeadingDeg != before.Environment.RunwayHeadingDeg || h.state.Environment.RunwayLengthNm != before.Environment.RunwayLengthNm || h.state.Environment.QNHhPa != before.Environment.QNHhPa {
		t.Fatal("published runway reference changed runway in use or pressure")
	}
	recovered, err := OpenBrowser(checkpointForTest(t, h))
	if err != nil {
		t.Fatal(err)
	}
	student := recovered.View("student").(StudentView)
	if !reflect.DeepEqual(student.Environment.PublishedAirspace, chart) || !reflect.DeepEqual(student.Environment.ReferenceBoundaries, boundaries) {
		t.Fatal("checkpoint/student projection lost published chart metadata")
	}
	exported := recovered.Export().(Exported)
	imported, _ := OpenBrowser(nil)
	if err := chartCommand(t, imported, "import-published", "import", map[string]any{"scenario": exported}, "instructor"); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(imported.state.Environment.PublishedAirspace, chart) {
		t.Fatal("exercise file roundtrip lost published chart")
	}
	raw, err := json.Marshal(imported.state.Environment.PublishedAirspace)
	if err != nil {
		t.Fatal(err)
	}
	var wire map[string]any
	if err = json.Unmarshal(raw, &wire); err != nil {
		t.Fatal(err)
	}
	fix := wire["fixes"].([]any)[0].(map[string]any)
	for _, axis := range []string{"xNm", "yNm"} {
		value, present := fix[axis]
		if !present || value != float64(0) {
			t.Fatalf("zero %s omitted on JSON roundtrip", axis)
		}
	}
	area := wire["areas"].([]any)[0].(map[string]any)
	if value, present := area["sourceIndex"]; !present || value != float64(0) {
		t.Fatal("first source reference omitted")
	}
	if value, present := area["notes"]; !present || value != "" {
		t.Fatal("explicitly supplied empty chart metadata omitted")
	}
}

func TestPublishedChartRejectsInvalidDataWithoutPartialMutation(t *testing.T) {
	cases := map[string]func(*PublishedAirspace){
		"excluded-base":        func(p *PublishedAirspace) { p.BaseID = "Sirsa" },
		"missing-origin":       func(p *PublishedAirspace) { p.Origin = nil },
		"latitude":             func(p *PublishedAirspace) { *p.Origin.Latitude = 85.01 },
		"missing-origin-axis":  func(p *PublishedAirspace) { p.Origin.Longitude = nil },
		"missing-sources":      func(p *PublishedAirspace) { p.Sources = nil },
		"source-too-long":      func(p *PublishedAirspace) { p.Sources[0].Source = strings.Repeat("a", 501) },
		"missing-source-index": func(p *PublishedAirspace) { p.Areas[0].SourceIndex = nil },
		"unknown-source-index": func(p *PublishedAirspace) { n := 1; p.Routes[0].SourceIndex = &n },
		"missing-axis":         func(p *PublishedAirspace) { p.Fixes[0].XNm = nil },
		"missing-vertex-axis":  func(p *PublishedAirspace) { p.Areas[0].Points[0].YNm = nil },
		"duplicate-identity":   func(p *PublishedAirspace) { p.Areas = append(p.Areas, p.Areas[0]) },
		"missing-selected-lfa": func(p *PublishedAirspace) { p.LFAID = "absent" },
		"missing-runway-width": func(p *PublishedAirspace) { p.Runways[0].WidthNm = nil },
		"oversized-package": func(p *PublishedAirspace) {
			p.Gaps = make([]string, 27)
			for i := range p.Gaps {
				p.Gaps[i] = strings.Repeat("x", 2000)
			}
		},
		"unverified-boundary": func(p *PublishedAirspace) {
			f := fixtureReferenceBoundary()
			f.Verification.Status = "unverified"
			p.ReferenceBoundaries = []ReferenceBoundary{f}
		},
	}
	for name, change := range cases {
		t.Run(name, func(t *testing.T) {
			h, _ := OpenBrowser(nil)
			before := checkpointForTest(t, h)
			chart := fixturePublishedChart(t)
			change(chart)
			p := chartReplacement(h.state)
			p["environment"] = map[string]any{"publishedAirspace": chart}
			if err := chartCommand(t, h, "invalid-published", "airspace-replace", p, "instructor"); err == nil {
				t.Fatal("invalid reference chart accepted")
			}
			if !bytes.Equal(before, checkpointForTest(t, h)) {
				t.Fatal("rejected chart changed state or journal")
			}
		})
	}
}

func TestPublishedChartAcceptsShared52KiBBudgetAndUnicodeLength(t *testing.T) {
	chart := fixturePublishedChart(t)
	chart.Gaps = make([]string, 25)
	for i := range chart.Gaps {
		chart.Gaps[i] = strings.Repeat("x", 2000)
	}
	raw, _ := json.Marshal(chart)
	if len(raw) <= 48*1024 || len(raw) > 52*1024 {
		t.Fatalf("budget fixture is %d bytes", len(raw))
	}
	if err := validatePublishedAirspace(chart); err != nil {
		t.Fatal(err)
	}
	chart = fixturePublishedChart(t)
	chart.Sources[0].Source = strings.Repeat("é", 500)
	if err := validatePublishedAirspace(chart); err != nil {
		t.Fatal("source text counted UTF-8 bytes instead of browser UTF-16 units", err)
	}
}

func TestReferenceBoundaryValidationMatchesBrowserLimits(t *testing.T) {
	valid := fixtureReferenceBoundary()
	valid.ID = "a:" + strings.Repeat("x", 78)
	valid.Name = strings.Repeat("n", 160)
	valid.Source.Authority = strings.Repeat("a", 240)
	valid.Geometry.Coordinates = [][][]float64{make([][]float64, 1024)}
	for i := range valid.Geometry.Coordinates[0] {
		valid.Geometry.Coordinates[0][i] = []float64{float64(i) / 100, 85}
	}
	if err := validateReferenceBoundaries([]ReferenceBoundary{valid}); err != nil {
		t.Fatal(err)
	}
	cases := map[string]func(*ReferenceBoundary){
		"identity-length":          func(f *ReferenceBoundary) { f.ID = strings.Repeat("x", 81) },
		"name-length":              func(f *ReferenceBoundary) { f.Name = strings.Repeat("x", 161) },
		"authority-length":         func(f *ReferenceBoundary) { f.Source.Authority = strings.Repeat("x", 241) },
		"control-character":        func(f *ReferenceBoundary) { f.Name = "test\nline" },
		"classification":           func(f *ReferenceBoundary) { f.Kind = "LoC"; f.Label = "IB" },
		"disguised-classification": func(f *ReferenceBoundary) { f.Label = " International Boundary " },
		"crs":                      func(f *ReferenceBoundary) { f.Source.CRS = "EPSG:3857" },
		"coordinate-order":         func(f *ReferenceBoundary) { f.Source.CoordinateOrder = "latitude-longitude" },
		"invalid-date":             func(f *ReferenceBoundary) { f.Source.EffectiveDate = "2026-02-30" },
		"url-credentials":          func(f *ReferenceBoundary) { f.Source.URL = "https://user:secret@example.test/data" },
		"approval-length":          func(f *ReferenceBoundary) { f.Verification.ApprovalReference = strings.Repeat("a", 241) },
		"latitude":                 func(f *ReferenceBoundary) { f.Geometry.Coordinates[0][0][1] = 85.1 },
		"closed-polygon-type":      func(f *ReferenceBoundary) { f.Geometry.Type = "Polygon" },
		"extra-coordinate":         func(f *ReferenceBoundary) { f.Geometry.Coordinates[0][0] = []float64{73, 18, 1} },
	}
	for name, change := range cases {
		t.Run(name, func(t *testing.T) {
			f := fixtureReferenceBoundary()
			change(&f)
			if validateReferenceBoundaries([]ReferenceBoundary{f}) == nil {
				t.Fatal("invalid boundary accepted")
			}
		})
	}
	valid.Geometry.Coordinates[0] = append(valid.Geometry.Coordinates[0], []float64{73, 18})
	if validateReferenceBoundaries([]ReferenceBoundary{valid}) == nil {
		t.Fatal("1025th boundary vertex accepted")
	}
	f := fixtureReferenceBoundary()
	if validateReferenceBoundaries([]ReferenceBoundary{f, f}) == nil {
		t.Fatal("duplicate boundary identifiers accepted")
	}
}

func TestCustomARPInvalidatesPublishedReferencesWithoutMovingLocalGeometry(t *testing.T) {
	cases := []struct {
		name    string
		payload map[string]any
		clear   bool
	}{
		{"geographic-origin", map[string]any{"chartOrigin": map[string]any{"latitude": 20}}, true},
		{"local-origin", map[string]any{"chartOrigin": nil}, true},
		{"drawn-arp", map[string]any{"drawnARP": true, "chartOrigin": nil}, true},
		{"station-x", map[string]any{"stationXNm": 5}, true},
		{"station-y", map[string]any{"stationYNm": -5}, true},
		{"same-reference", map[string]any{"chartOrigin": ChartOrigin{Latitude: 18.58, Longitude: 73.91}, "drawnARP": false, "stationXNm": 0, "stationYNm": 0}, false},
		{"wind", map[string]any{"windSpeedKt": 20}, false},
		{"runway-in-use", map[string]any{"runwayHeadingDeg": 280}, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			h, _ := OpenBrowser(nil)
			h.state.Elapsed = 125
			h.state.Environment.ChartOrigin = &ChartOrigin{Latitude: 18.58, Longitude: 73.91}
			h.state.Environment.StationXNm, h.state.Environment.StationYNm = 0, 0
			h.state.Environment.PublishedAirspace = fixturePublishedChart(t)
			h.state.Environment.ReferenceBoundaries = []ReferenceBoundary{fixtureReferenceBoundary()}
			before := clone(h.state)
			if err := chartCommand(t, h, "change-arp", "environment", tc.payload, "instructor"); err != nil {
				t.Fatal(err)
			}
			cleared := h.state.Environment.PublishedAirspace == nil && len(h.state.Environment.ReferenceBoundaries) == 0
			if cleared != tc.clear {
				t.Fatalf("published references cleared=%v, want %v", cleared, tc.clear)
			}
			if !tc.clear && (!reflect.DeepEqual(h.state.Environment.PublishedAirspace, before.Environment.PublishedAirspace) || !reflect.DeepEqual(h.state.Environment.ReferenceBoundaries, before.Environment.ReferenceBoundaries)) {
				t.Fatal("unchanged reference metadata was altered")
			}
			if h.state.Elapsed != before.Elapsed || !reflect.DeepEqual(h.state.Aircraft, before.Aircraft) || !reflect.DeepEqual(h.state.Fixes, before.Fixes) || !reflect.DeepEqual(h.state.Routes, before.Routes) || !reflect.DeepEqual(h.state.Areas, before.Areas) {
				t.Fatal("changing chart reference moved local navigation or traffic")
			}
		})
	}
	h, _ := OpenBrowser(nil)
	h.state.Environment.PublishedAirspace = fixturePublishedChart(t)
	h.state.Environment.ReferenceBoundaries = []ReferenceBoundary{fixtureReferenceBoundary()}
	chart := fixturePublishedChart(t)
	chart.LayerVisibility["lfa"] = false
	if err := chartCommand(t, h, "hide-lfa", "environment", map[string]any{"publishedAirspace": chart}, "instructor"); err != nil {
		t.Fatal(err)
	}
	if h.state.Environment.PublishedAirspace == nil || h.state.Environment.PublishedAirspace.LayerVisibility["lfa"] || len(h.state.Environment.ReferenceBoundaries) != 1 {
		t.Fatal("visibility-only update cleared published references")
	}
}
