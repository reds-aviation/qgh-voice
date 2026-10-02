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
