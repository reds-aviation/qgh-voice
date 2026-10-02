package procedural

import (
	"errors"
	"math"
	"strings"
)

func validateArea(a AirspaceArea) error {
	if !validID(a.ID) || strings.TrimSpace(a.Name) == "" || !short(a.Name, 100) || !short(a.FloorLabel, 80) || !short(a.CeilingLabel, 80) || !short(a.Source, 100) || !short(a.Reference, 500) || !short(a.EffectiveInfo, 500) || !short(a.Notes, 1000) {
		return errors.New("invalid chart area identifier, name or metadata")
	}
	switch a.Kind {
	case "prohibited", "restricted", "danger", "local-flying", "control-zone":
	default:
		return errors.New("area kind must be prohibited, restricted, danger, local-flying or control-zone")
	}
	if len(a.Points) < 3 || len(a.Points) > 200 {
		return errors.New("chart area needs 3–200 polygon vertices")
	}
	if a.CoordinateOrigin != nil || len(a.GeoPoints) > 0 {
		if a.CoordinateOrigin == nil || len(a.GeoPoints) != len(a.Points) || !validGeoPoint(*a.CoordinateOrigin) {
			return errors.New("geographic boundary needs an ARP and one valid coordinate per vertex")
		}
		for i, geo := range a.GeoPoints {
			if !validGeoPoint(geo) {
				return errors.New("geographic boundary latitude or longitude is invalid")
			}
			p := projectAreaCoordinate(geo, *a.CoordinateOrigin)
			if math.Hypot(p.XNm-a.Points[i].XNm, p.YNm-a.Points[i].YNm) > .01 {
				return errors.New("geographic boundary does not match its projected points and ARP")
			}
		}
	}
	twiceArea := 0.0
	seen := map[Point]bool{}
	for i, p := range a.Points {
		if !between(p.XNm, -2000, 2000) || !between(p.YNm, -2000, 2000) {
			return errors.New("chart vertices must be within 2000 NM of the station")
		}
		if seen[p] {
			return errors.New("chart polygon has duplicate vertices")
		}
		seen[p] = true
		q := a.Points[(i+1)%len(a.Points)]
		twiceArea += p.XNm*q.YNm - p.YNm*q.XNm
	}
	if math.Abs(twiceArea) < 1e-8 {
		return errors.New("chart polygon must enclose a nonzero area")
	}
	for i, p := range a.Points {
		q := a.Points[(i+1)%len(a.Points)]
		for j := i + 1; j < len(a.Points); j++ {
			if j == i+1 || (i == 0 && j == len(a.Points)-1) {
				continue
			}
			r, t := a.Points[j], a.Points[(j+1)%len(a.Points)]
			if intersects(p, q, r, t) {
				return errors.New("chart polygon edges must not cross or touch themselves")
			}
		}
	}
	return nil
}
func validGeoPoint(p ChartOrigin) bool {
	return between(p.Latitude, -89.999999, 89.999999) && between(p.Longitude, -180, 180)
}
func projectAreaCoordinate(p, origin ChartOrigin) Point {
	const rad = math.Pi / 180
	lat, base, dl := p.Latitude*rad, origin.Latitude*rad, (p.Longitude-origin.Longitude)*rad
	h := math.Pow(math.Sin((lat-base)/2), 2) + math.Cos(base)*math.Cos(lat)*math.Pow(math.Sin(dl/2), 2)
	distance := 2 * 3440.065 * math.Asin(math.Sqrt(math.Min(1, math.Max(0, h))))
	bearing := math.Atan2(math.Sin(dl)*math.Cos(lat), math.Cos(base)*math.Sin(lat)-math.Sin(base)*math.Cos(lat)*math.Cos(dl))
	return Point{XNm: distance * math.Sin(bearing), YNm: distance * math.Cos(bearing)}
}
func cross(a, b, c Point) float64 { return (b.XNm-a.XNm)*(c.YNm-a.YNm) - (b.YNm-a.YNm)*(c.XNm-a.XNm) }
func onSegment(a, b, p Point) bool {
	return p.XNm >= math.Min(a.XNm, b.XNm)-1e-9 && p.XNm <= math.Max(a.XNm, b.XNm)+1e-9 && p.YNm >= math.Min(a.YNm, b.YNm)-1e-9 && p.YNm <= math.Max(a.YNm, b.YNm)+1e-9
}
func intersects(a, b, c, d Point) bool {
	abC, abD, cdA, cdB := cross(a, b, c), cross(a, b, d), cross(c, d, a), cross(c, d, b)
	if ((abC > 0 && abD < 0) || (abC < 0 && abD > 0)) && ((cdA > 0 && cdB < 0) || (cdA < 0 && cdB > 0)) {
		return true
	}
	return (math.Abs(abC) < 1e-9 && onSegment(a, b, c)) || (math.Abs(abD) < 1e-9 && onSegment(a, b, d)) || (math.Abs(cdA) < 1e-9 && onSegment(c, d, a)) || (math.Abs(cdB) < 1e-9 && onSegment(c, d, b))
}
