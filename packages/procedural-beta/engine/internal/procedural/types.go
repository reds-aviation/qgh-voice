// Package procedural implements an offline, synthetic instructor-led exercise.
// Geometry and configurable measurements are training aids, not ATS minima.
package procedural

import "encoding/json"

const Version = 1
const MaxAircraft = 24

type Command struct {
	ID         string          `json:"id"`
	Type       string          `json:"type"`
	ExerciseID string          `json:"exerciseId,omitempty"`
	AircraftID string          `json:"aircraftId,omitempty"`
	Payload    json.RawMessage `json:"payload"`
}
type MapCalibration struct {
	ImageID     string  `json:"imageId"`
	WidthNm     float64 `json:"widthNm"`
	OriginXPct  float64 `json:"originXPct"`
	OriginYPct  float64 `json:"originYPct"`
	RotationDeg float64 `json:"rotationDeg"`
	Opacity     float64 `json:"opacity"`
}
type Environment struct {
	RangeNm                      float64        `json:"rangeNm"`
	ChartOrigin                  *ChartOrigin   `json:"chartOrigin,omitempty"`
	StationName                  string         `json:"stationName"`
	StationType                  string         `json:"stationType"`
	StationXNm                   float64        `json:"stationXNm"`
	StationYNm                   float64        `json:"stationYNm"`
	StationFrequency             string         `json:"stationFrequency"`
	AerodromeName                string         `json:"aerodromeName"`
	ChartReference               string         `json:"chartReference"`
	EffectiveInfo                string         `json:"effectiveInfo"`
	Briefing                     string         `json:"briefing"`
	MagneticVariationDeg         float64        `json:"magneticVariationDeg"`
	MagneticVariationKnown       *bool          `json:"magneticVariationKnown,omitempty"`
	TrainingMagneticVariationDeg *float64       `json:"trainingMagneticVariationDeg,omitempty"`
	DFHoldSeconds                float64        `json:"dfHoldSeconds"`
	RunwayHeadingDeg             float64        `json:"runwayHeadingDeg"`
	RunwayLengthNm               float64        `json:"runwayLengthNm"`
	AerodromeElevationFt         float64        `json:"aerodromeElevationFt"`
	QNHhPa                       float64        `json:"qnhHpa"`
	TransitionAltitudeFt         float64        `json:"transitionAltitudeFt"`
	TransitionLevel              float64        `json:"transitionLevel"`
	ThresholdCrossingHeightFt    float64        `json:"thresholdCrossingHeightFt"`
	WindDirectionDeg             float64        `json:"windDirectionDeg"`
	WindSpeedKt                  float64        `json:"windSpeedKt"`
	SeparationNm                 float64        `json:"separationNm"`
	SeparationFt                 float64        `json:"separationFt"`
	SeparationMinutes            float64        `json:"separationMinutes"`
	Map                          MapCalibration `json:"map"`
}
type ChartOrigin struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
}
type Fix struct {
	ID   string  `json:"id"`
	Name string  `json:"name"`
	XNm  float64 `json:"xNm"`
	YNm  float64 `json:"yNm"`
}
type Route struct {
	ID             string   `json:"id"`
	Name           string   `json:"name"`
	Kind           string   `json:"kind"`
	FixIDs         []string `json:"fixIds"`
	Active         bool     `json:"active"`
	AvailableFrom  float64  `json:"availableFrom"`
	AvailableUntil float64  `json:"availableUntil"`
	MinAltitudeFt  float64  `json:"minAltitudeFt"`
	MaxAltitudeFt  float64  `json:"maxAltitudeFt"`
	Source         string   `json:"source,omitempty"`
	Reference      string   `json:"reference,omitempty"`
	LevelLimits    string   `json:"levelLimits,omitempty"`
	EffectiveInfo  string   `json:"effectiveInfo,omitempty"`
}
type Point struct {
	XNm float64 `json:"xNm"`
	YNm float64 `json:"yNm"`
}

// Chart labels retain their published vertical and effective-date references;
// their presence does not authorize a route or imply automatic airspace checking.
type AirspaceArea struct {
	ID            string  `json:"id"`
	Name          string  `json:"name"`
	Kind          string  `json:"kind"`
	Points        []Point `json:"points"`
	FloorLabel    string  `json:"floorLabel"`
	CeilingLabel  string  `json:"ceilingLabel"`
	Source        string  `json:"source"`
	Reference     string  `json:"reference"`
	EffectiveInfo string  `json:"effectiveInfo"`
	Notes         string  `json:"notes,omitempty"`
	Active        bool    `json:"active"`
}
type Condition struct {
	Kind  string  `json:"kind"`
	At    float64 `json:"at,omitempty"`
	FixID string  `json:"fixId,omitempty"`
}
type Clearance struct {
	Action           string     `json:"action"`
	Reference        string     `json:"reference,omitempty"`
	Value            *float64   `json:"value,omitempty"`
	FixID            string     `json:"fixId,omitempty"`
	RouteID          string     `json:"routeId,omitempty"`
	Direction        string     `json:"direction,omitempty"`
	InboundCourseDeg float64    `json:"inboundCourseDeg,omitempty"`
	LegSeconds       float64    `json:"legSeconds,omitempty"`
	Condition        *Condition `json:"condition,omitempty"`
}
type HoldState struct {
	FixID            string  `json:"fixId"`
	InboundCourseDeg float64 `json:"inboundCourseDeg"`
	Direction        string  `json:"direction"`
	LegSeconds       float64 `json:"legSeconds"`
	Phase            string  `json:"phase"`
	PhaseElapsed     float64 `json:"phaseElapsed"`
	ResumeMode       string  `json:"resumeMode"`
	ResumeRouteID    string  `json:"resumeRouteId"`
	ResumeRouteIndex int     `json:"resumeRouteIndex"`
}
type OrbitState struct {
	Direction       string  `json:"direction"`
	EntryHeadingDeg float64 `json:"entryHeadingDeg"`
	Degrees         float64 `json:"degrees"`
	Laps            int     `json:"laps"`
	ExitRequested   bool    `json:"exitRequested"`
}
type Aircraft struct {
	ID                   string             `json:"id"`
	Callsign             string             `json:"callsign"`
	Type                 string             `json:"type"`
	XNm                  float64            `json:"xNm"`
	YNm                  float64            `json:"yNm"`
	HeadingDeg           float64            `json:"headingDeg"`
	SpeedKt              float64            `json:"speedKt"`
	AltitudeFt           float64            `json:"altitudeFt"`
	AltimeterReference   string             `json:"altimeterReference"`
	TargetAltitudeFt     float64            `json:"targetAltitudeFt"`
	VerticalRateFpm      float64            `json:"verticalRateFpm"`
	TurnRateDegSec       float64            `json:"turnRateDegSec"`
	CompassUnserviceable bool               `json:"compassUnserviceable,omitempty"`
	Mode                 string             `json:"mode"`
	Status               string             `json:"status"`
	RouteID              string             `json:"routeId"`
	RouteIndex           int                `json:"routeIndex"`
	SpawnTime            float64            `json:"spawnTime"`
	TargetHeadingDeg     float64            `json:"targetHeadingDeg"`
	TargetSpeedKt        float64            `json:"targetSpeedKt"`
	TurnDirection        string             `json:"turnDirection"`
	ContinuousTurn       bool               `json:"continuousTurn"`
	DirectFixID          string             `json:"directFixId"`
	Hold                 *HoldState         `json:"hold,omitempty"`
	Orbit                *OrbitState        `json:"orbit,omitempty"`
	PendingClearances    []Clearance        `json:"pendingClearances"`
	LastFixTimes         map[string]float64 `json:"lastFixTimes"`
	GroundTargetX        float64            `json:"groundTargetX"`
	GroundTargetY        float64            `json:"groundTargetY"`
	RunwayProgress       float64            `json:"runwayProgress"`
	WakeCategory         string             `json:"wakeCategory"`
}
type Strip struct {
	Estimate  string `json:"estimate"`
	Clearance string `json:"clearance"`
	Notes     string `json:"notes"`
}
type Call struct {
	ID         string  `json:"id"`
	AircraftID string  `json:"aircraftId"`
	Text       string  `json:"text"`
	Elapsed    float64 `json:"elapsed"`
	Status     string  `json:"status"`
}
type Report struct {
	ID         string  `json:"id"`
	AircraftID string  `json:"aircraftId"`
	Callsign   string  `json:"callsign"`
	Text       string  `json:"text"`
	Elapsed    float64 `json:"elapsed"`
	Source     string  `json:"source"`
}
type Event struct {
	ID         string  `json:"id"`
	Elapsed    float64 `json:"elapsed"`
	Kind       string  `json:"kind"`
	Text       string  `json:"text"`
	AircraftID string  `json:"aircraftId,omitempty"`
	Truth      []Truth `json:"truth,omitempty"`
}
type Truth struct {
	AircraftID string  `json:"aircraftId"`
	XNm        float64 `json:"xNm"`
	YNm        float64 `json:"yNm"`
	AltitudeFt float64 `json:"altitudeFt"`
	HeadingDeg float64 `json:"headingDeg"`
	SpeedKt    float64 `json:"speedKt"`
}
type Criterion struct {
	ID            string  `json:"id"`
	Kind          string  `json:"kind"`
	AircraftA     string  `json:"aircraftA"`
	AircraftB     string  `json:"aircraftB"`
	Minimum       float64 `json:"minimum"`
	Unit          string  `json:"unit"`
	Reference     string  `json:"reference"`
	Applicability string  `json:"applicability"`
	Evidence      string  `json:"evidence"`
	Assessment    string  `json:"assessment"`
	ExpiresAt     float64 `json:"expiresAt"`
	Notes         string  `json:"notes"`
}
type Alert struct {
	ID          string   `json:"id"`
	Kind        string   `json:"kind"`
	AircraftIDs []string `json:"aircraftIds"`
	Text        string   `json:"text"`
	Measured    *float64 `json:"measured,omitempty"`
	Threshold   *float64 `json:"threshold,omitempty"`
	Unit        string   `json:"unit,omitempty"`
	CriterionID string   `json:"criterionId,omitempty"`
}
type RadioView struct {
	ID          string `json:"id"`
	AircraftID  string `json:"aircraftId"`
	Callsign    string `json:"callsign"`
	Text        string `json:"text"`
	Phase       string `json:"phase"`
	RemainingMs int64  `json:"remainingMs"`
}
type DFView struct {
	Source               string   `json:"source"`
	Callsign             string   `json:"callsign"`
	QTE                  *float64 `json:"qteDeg"`
	QDM                  *float64 `json:"qdmDeg"`
	MagneticReference    string   `json:"magneticReference"`
	MagneticVariationDeg *float64 `json:"magneticVariationDeg"`
	Valid                bool     `json:"valid"`
	Phase                string   `json:"phase"`
	RemainingMs          int64    `json:"remainingMs"`
}

// ScopeDisplay is shared chart presentation only. It never filters navigation
// data used by aircraft, clearances, or the chart briefing.
type ScopeDisplay struct {
	HiddenRouteIDs []string `json:"hiddenRouteIds"`
	HiddenAreaIDs  []string `json:"hiddenAreaIds"`
	RoutesHidden   bool     `json:"routesHidden"`
	AreasHidden    bool     `json:"areasHidden"`
}
type State struct {
	Version      int              `json:"version"`
	ExerciseID   string           `json:"exerciseId"`
	Revision     uint64           `json:"revision"`
	Elapsed      float64          `json:"elapsed"`
	Running      bool             `json:"running"`
	Terminated   bool             `json:"terminated"`
	Mode         string           `json:"mode"`
	Title        string           `json:"title"`
	Environment  Environment      `json:"environment"`
	Fixes        []Fix            `json:"fixes"`
	Routes       []Route          `json:"routes"`
	Areas        []AirspaceArea   `json:"areas"`
	ScopeDisplay ScopeDisplay     `json:"scopeDisplay"`
	Aircraft     []Aircraft       `json:"aircraft"`
	Strips       map[string]Strip `json:"strips"`
	Calls        []Call           `json:"calls"`
	Reports      []Report         `json:"reports"`
	Events       []Event          `json:"events"`
	Criteria     []Criterion      `json:"criteria"`
	Radio        RadioView        `json:"radio"`
	Sequence     uint64           `json:"sequence"`
}
type RosterEntry struct {
	ID       string `json:"id"`
	Callsign string `json:"callsign"`
	Type     string `json:"type"`
	RouteID  string `json:"routeId"`
	Status   string `json:"status"`
}

// This allowlist intentionally has no Aircraft, event, alert, schedule or truth field.
type StudentView struct {
	Version      int              `json:"version"`
	ExerciseID   string           `json:"exerciseId"`
	Role         string           `json:"role"`
	Available    bool             `json:"available"`
	Revision     uint64           `json:"revision"`
	Elapsed      float64          `json:"elapsed"`
	Running      bool             `json:"running"`
	Terminated   bool             `json:"terminated"`
	Mode         string           `json:"mode"`
	Title        string           `json:"title"`
	Environment  Environment      `json:"environment"`
	Fixes        []Fix            `json:"fixes"`
	Routes       []Route          `json:"routes"`
	Areas        []AirspaceArea   `json:"areas"`
	ScopeDisplay ScopeDisplay     `json:"scopeDisplay"`
	Roster       []RosterEntry    `json:"roster"`
	Strips       map[string]Strip `json:"strips"`
	Radio        RadioView        `json:"radio"`
	DF           *DFView          `json:"df"`
	Calls        []Call           `json:"calls"`
	Reports      []Report         `json:"reports"`
	Criteria     []Criterion      `json:"criteria"`
}
type InstructorView struct {
	StudentView
	Aircraft []Aircraft `json:"aircraft"`
	Events   []Event    `json:"events"`
	Alerts   []Alert    `json:"alerts"`
}
type Exported struct {
	Version  int   `json:"version"`
	Scenario State `json:"scenario"`
}
type Receipt struct {
	ID       string `json:"id"`
	Revision uint64 `json:"revision"`
	Accepted bool   `json:"accepted"`
}
