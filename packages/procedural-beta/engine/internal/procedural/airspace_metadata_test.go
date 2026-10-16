/*
The contents of this file are subject to the Common Public Attribution License Version 1.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at https://opensource.org/license/cpal_1-0. The License is based on the Mozilla Public License Version 1.1 but Sections 14 and 15 have been added to cover use of software over a computer network and provide for limited attribution for the Original Developer. In addition, Exhibit A has been modified to be consistent with Exhibit B.
Software distributed under the License is distributed on an "AS IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License for the specific language governing rights and limitations under the License.
The Original Code is ATS SIM BOX.
The Original Developer is the Initial Developer.
The Initial Developer of the Original Code is Balaram Reddy. All portions of the code written by Balaram Reddy are Copyright (c) 2026 Balaram Reddy. All Rights Reserved.
Contributor(s): None designated in this initial notice.
No alternative licence is designated for this CPAL version. Historical MIT releases retain the permissions described in COPYRIGHT.md.
*/

package procedural

import "testing"

func TestAirspaceCoordinateMetadata(t *testing.T) {
	origin := ChartOrigin{Latitude: 26, Longitude: 73}
	geo := []ChartOrigin{{Latitude: 26, Longitude: 73}, {Latitude: 26, Longitude: 73.1}, {Latitude: 26.1, Longitude: 73.1}, {Latitude: 26.1, Longitude: 73}}
	points := make([]Point, len(geo))
	for i, p := range geo {
		points[i] = projectAreaCoordinate(p, origin)
	}
	area := AirspaceArea{ID: "test-area", Name: "LFA", Kind: "local-flying", Points: points, CoordinateOrigin: &origin, GeoPoints: geo}
	if err := validateArea(area); err != nil {
		t.Fatal(err)
	}
	old := area
	old.CoordinateOrigin = nil
	old.GeoPoints = nil
	if err := validateArea(old); err != nil {
		t.Fatalf("old projected-only snapshots remain valid: %v", err)
	}
	bad := area
	bad.CoordinateOrigin = nil
	if validateArea(bad) == nil {
		t.Fatal("geographic points require origin")
	}
	bad = area
	bad.GeoPoints = geo[:3]
	if validateArea(bad) == nil {
		t.Fatal("geographic count must match projected ring")
	}
	bad = area
	bad.GeoPoints = append([]ChartOrigin{}, geo...)
	bad.GeoPoints[0].Latitude = 91
	if validateArea(bad) == nil {
		t.Fatal("out of range latitude accepted")
	}
	bad = area
	bad.Points = append([]Point{}, points...)
	bad.Points[0].XNm += .1
	if validateArea(bad) == nil {
		t.Fatal("geographic metadata must match local ring")
	}
}
