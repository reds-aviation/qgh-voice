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
	"errors"
	"strings"
)

// Public chart references have no effect on flight state, clearances or runway in use.
type PublishedAirspace struct {
	SchemaVersion       int                     `json:"schemaVersion"`
	BaseID              string                  `json:"baseId"`
	BaseName            string                  `json:"baseName"`
	LFAID               string                  `json:"lfaId"`
	LFAName             string                  `json:"lfaName"`
	SelectionID         string                  `json:"selectionId"`
	Source              string                  `json:"source"`
	EffectiveInfo       string                  `json:"effectiveInfo"`
	Status              string                  `json:"status"`
	Origin              *PublishedChartOrigin   `json:"origin"`
	Sources             []PublishedChartSource  `json:"sources"`
	LayerVisibility     map[string]bool         `json:"layerVisibility"`
	Areas               []PublishedChartFeature `json:"areas"`
	Routes              []PublishedChartFeature `json:"routes"`
	Runways             []PublishedChartFeature `json:"runways"`
	Fixes               []PublishedChartFeature `json:"fixes"`
	ReferenceBoundaries []ReferenceBoundary     `json:"referenceBoundaries"`
	Gaps                []string                `json:"gaps"`
}
type PublishedChartSource struct {
	Source        string `json:"source"`
	EffectiveInfo string `json:"effectiveInfo"`
}
type PublishedChartOrigin struct {
	Latitude  *float64 `json:"latitude"`
	Longitude *float64 `json:"longitude"`
}
type PublishedChartPoint struct {
	XNm *float64 `json:"xNm"`
	YNm *float64 `json:"yNm"`
}
type PublishedChartFeature struct {
	ID            string                `json:"id"`
	Name          string                `json:"name"`
	Kind          string                `json:"kind,omitempty"`
	Points        []PublishedChartPoint `json:"points,omitempty"`
	XNm           *float64              `json:"xNm,omitempty"`
	YNm           *float64              `json:"yNm,omitempty"`
	WidthNm       *float64              `json:"widthNm,omitempty"`
	SourceIndex   *int                  `json:"sourceIndex,omitempty"`
	Source        *string               `json:"source,omitempty"`
	Reference     *string               `json:"reference,omitempty"`
	EffectiveInfo *string               `json:"effectiveInfo,omitempty"`
	Notes         *string               `json:"notes,omitempty"`
	FloorLabel    *string               `json:"floorLabel,omitempty"`
	CeilingLabel  *string               `json:"ceilingLabel,omitempty"`
	LevelLimits   *string               `json:"levelLimits,omitempty"`
}

// A custom ARP changes the chart reference, not existing local navigation.
// Published packages must be loaded explicitly with airspace-replace again.
func chartReferenceChanged(before, after Environment) bool {
	if before.DrawnARP != after.DrawnARP || before.StationXNm != after.StationXNm || before.StationYNm != after.StationYNm {
		return true
	}
	if before.ChartOrigin == nil || after.ChartOrigin == nil {
		return before.ChartOrigin != after.ChartOrigin
	}
	return *before.ChartOrigin != *after.ChartOrigin
}

func validatePublishedAirspace(p *PublishedAirspace) error {
	if p == nil {
		return nil
	}
	invalid := errors.New("invalid published airspace chart package")
	if p.SchemaVersion != 1 || strings.EqualFold(p.BaseID, "sirsa") || strings.EqualFold(p.BaseID, "jamnagar") || p.BaseID == "" || p.BaseName == "" || p.LFAID == "" {
		return invalid
	}
	for _, v := range []string{p.BaseID, p.BaseName, p.LFAID, p.LFAName, p.SelectionID, p.Source, p.EffectiveInfo, p.Status} {
		if !publishedText(v, 2000) {
			return invalid
		}
	}
	if p.Origin == nil || p.Origin.Latitude == nil || p.Origin.Longitude == nil || !between(*p.Origin.Latitude, -85, 85) || !between(*p.Origin.Longitude, -180, 180) {
		return invalid
	}
	if p.Sources == nil || len(p.Sources) > 100 {
		return invalid
	}
	for _, source := range p.Sources {
		if !publishedText(source.Source, 500) || !publishedText(source.EffectiveInfo, 1000) {
			return invalid
		}
	}
	layers := map[string]bool{"lfa": true, "arp": true, "runways": true, "atsRoutes": true, "controlledAirspace": true, "specialUse": true, "internationalBoundary": true}
	for k := range p.LayerVisibility {
		if !layers[k] {
			return invalid
		}
	}
	found := false
	groups := []struct {
		rows           []PublishedChartFeature
		max, minPoints int
		kind           string
	}{{p.Areas, 200, 3, "areas"}, {p.Routes, 100, 2, "routes"}, {p.Runways, 12, 2, "runways"}, {p.Fixes, 200, 0, "fixes"}}
	for _, group := range groups {
		if group.rows == nil || len(group.rows) > group.max {
			return invalid
		}
		seen := map[string]bool{}
		for _, f := range group.rows {
			if f.ID == "" || !publishedText(f.ID, 150) || f.Name == "" || !publishedText(f.Name, 250) || seen[f.ID] {
				return invalid
			}
			seen[f.ID] = true
			if group.minPoints > 0 && (len(f.Points) < group.minPoints || len(f.Points) > 500) {
				return invalid
			}
			for _, pt := range f.Points {
				if pt.XNm == nil || pt.YNm == nil || !between(*pt.XNm, -2000, 2000) || !between(*pt.YNm, -2000, 2000) {
					return invalid
				}
			}
			if group.minPoints > 0 && (f.SourceIndex == nil || *f.SourceIndex < 0 || *f.SourceIndex >= len(p.Sources)) {
				return invalid
			}
			if group.kind == "fixes" && (f.XNm == nil || f.YNm == nil || !between(*f.XNm, -2000, 2000) || !between(*f.YNm, -2000, 2000)) {
				return invalid
			}
			if f.Notes != nil && !publishedText(*f.Notes, 4000) {
				return invalid
			}
			for _, v := range []*string{f.Source, f.Reference, f.EffectiveInfo, f.FloorLabel, f.CeilingLabel, f.LevelLimits} {
				if v != nil && !publishedText(*v, 2000) {
					return invalid
				}
			}
			if group.kind == "areas" {
				if f.Kind != "local-flying" && f.Kind != "prohibited" && f.Kind != "restricted" && f.Kind != "danger" && f.Kind != "control-zone" {
					return invalid
				}
				if f.ID == p.LFAID {
					found = true
				}
			}
			if group.kind == "runways" && (f.WidthNm == nil || !between(*f.WidthNm, 0, 1) || *f.WidthNm == 0 || len(f.Points) != 2) {
				return invalid
			}
		}
	}
	if !found || len(p.Gaps) > 30 {
		return invalid
	}
	for _, gap := range p.Gaps {
		if !publishedText(gap, 2000) {
			return invalid
		}
	}
	if err := validateReferenceBoundaries(p.ReferenceBoundaries); err != nil {
		return err
	}
	// Match JSON.stringify's UTF-8 size, avoiding Go's optional HTML escaping.
	var raw bytes.Buffer
	encoder := json.NewEncoder(&raw)
	encoder.SetEscapeHTML(false)
	if err := encoder.Encode(p); err != nil || len(bytes.TrimSuffix(raw.Bytes(), []byte("\n"))) > 52*1024 {
		return errors.New("published airspace exceeds the shared chart size limit")
	}
	return nil
}
