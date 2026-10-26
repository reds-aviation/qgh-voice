/*
The contents of this file are subject to the Common Public Attribution License Version 1.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at https://opensource.org/license/cpal_1-0.
Software distributed under the License is distributed on an "AS IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License for the specific language governing rights and limitations under the License.
The Original Code is ATS SIM BOX. The Initial Developer is Balaram Reddy. All portions of the code written by Balaram Reddy are Copyright (c) 2026 Balaram Reddy. All Rights Reserved.
Contributor(s): None designated. No alternative licence is designated for this CPAL version. Historical MIT releases retain the permissions described in COPYRIGHT.md.
*/

package procedural

import (
	"errors"
	"net/url"
	"regexp"
	"strings"
	"time"
	"unicode/utf16"
)

// Reference boundaries are chart annotations, never navigation or area polygons.
// Source vertices and the source's boundary classification survive export intact.
type ReferenceBoundary struct {
	ID           string               `json:"id"`
	Name         string               `json:"name"`
	Kind         string               `json:"kind"`
	Label        string               `json:"label"`
	Geometry     BoundaryGeometry     `json:"geometry"`
	Source       BoundarySource       `json:"source"`
	Verification BoundaryVerification `json:"verification"`
}
type BoundaryGeometry struct {
	Type        string        `json:"type"`
	Coordinates [][][]float64 `json:"coordinates"`
}
type BoundarySource struct {
	Authority       string `json:"authority"`
	Title           string `json:"title"`
	Section         string `json:"section"`
	URL             string `json:"url,omitempty"`
	CRS             string `json:"crs"`
	CoordinateOrder string `json:"coordinateOrder"`
	EffectiveDate   string `json:"effectiveDate"`
}
type BoundaryVerification struct {
	Status            string `json:"status"`
	VerifiedBy        string `json:"verifiedBy"`
	VerifiedAt        string `json:"verifiedAt"`
	ApprovalReference string `json:"approvalReference"`
}

var boundaryIdentifier = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._:-]*$`)

// Browser contracts count UTF-16 units; ordinary engine short() uses bytes.
func publishedText(value string, maximum int) bool {
	return len(utf16.Encode([]rune(value))) <= maximum && !strings.ContainsRune(value, 0)
}
func boundaryText(value string, maximum int) bool {
	if strings.TrimSpace(value) == "" || !publishedText(value, maximum) {
		return false
	}
	for _, r := range value {
		if r < 32 || r == 127 {
			return false
		}
	}
	return true
}
func boundaryDate(value string) bool {
	_, err := time.Parse("2006-01-02", value)
	return len(value) == 10 && err == nil
}
func validateReferenceBoundaries(features []ReferenceBoundary) error {
	if len(features) > 16 {
		return errors.New("maximum 16 reference boundaries")
	}
	seen, vertices := map[string]bool{}, 0
	for _, f := range features {
		if !boundaryText(f.ID, 80) || !boundaryIdentifier.MatchString(f.ID) || seen[f.ID] || !boundaryText(f.Name, 160) {
			return errors.New("invalid reference boundary identity")
		}
		seen[f.ID] = true
		label := strings.TrimSpace(f.Label)
		if f.Kind != "IB" && f.Kind != "LoC" && f.Kind != "OTHER" || !boundaryText(f.Label, 32) || f.Kind != "OTHER" && label != f.Kind || f.Kind == "OTHER" && (strings.EqualFold(label, "IB") || strings.EqualFold(label, "LoC") || strings.EqualFold(label, "International Boundary") || strings.EqualFold(label, "Line of Control")) {
			return errors.New("reference boundary must retain its exact source classification")
		}
		s, v := f.Source, f.Verification
		if !boundaryText(s.Authority, 240) || !boundaryText(s.Title, 240) || !boundaryText(s.Section, 240) || (s.CRS != "EPSG:4326" && s.CRS != "OGC:CRS84") || s.CoordinateOrder != "longitude-latitude" || !boundaryDate(s.EffectiveDate) || s.URL != "" && !boundaryText(s.URL, 2048) {
			return errors.New("reference boundary needs dated source and explicit geographic CRS")
		}
		if s.URL != "" {
			u, err := url.Parse(s.URL)
			if err != nil || u.Scheme != "https" || u.Hostname() == "" || u.User != nil {
				return errors.New("invalid boundary source URL")
			}
		}
		if v.Status != "verified" || !boundaryText(v.VerifiedBy, 160) || !boundaryDate(v.VerifiedAt) || !boundaryText(v.ApprovalReference, 240) {
			return errors.New("reference boundary requires verified provenance")
		}
		if f.Geometry.Type != "MultiLineString" || len(f.Geometry.Coordinates) == 0 || len(f.Geometry.Coordinates) > 64 {
			return errors.New("reference boundary requires explicit line geometry")
		}
		for _, line := range f.Geometry.Coordinates {
			if len(line) < 2 {
				return errors.New("reference boundary line needs at least two vertices")
			}
			vertices += len(line)
			if vertices > 1024 {
				return errors.New("reference boundaries exceed 1024 vertices")
			}
			for _, p := range line {
				if len(p) != 2 || !between(p[0], -180, 180) || !between(p[1], -85, 85) {
					return errors.New("invalid reference boundary coordinate")
				}
			}
		}
	}
	return nil
}
