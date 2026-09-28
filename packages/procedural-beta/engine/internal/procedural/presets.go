package procedural

func defaults() Environment {
	return Environment{RangeNm: 60, StationName: "NAV0", StationType: "df", DFHoldSeconds: 10, QNHhPa: 1013.25, ThresholdCrossingHeightFt: 50, RunwayHeadingDeg: 90, RunwayLengthNm: 1.5, SeparationNm: 5, SeparationFt: 1000, SeparationMinutes: 5, Map: MapCalibration{WidthNm: 120, OriginXPct: 50, OriginYPct: 50, Opacity: 0.45}}
}
func baseAircraft(id, callsign string, x, y, heading, speed, alt float64) Aircraft {
	return Aircraft{ID: id, Callsign: callsign, Type: "A320", XNm: x, YNm: y, HeadingDeg: heading, TargetHeadingDeg: heading, SpeedKt: speed, TargetSpeedKt: speed, AltitudeFt: alt, AltimeterReference: "qnh", TargetAltitudeFt: alt, VerticalRateFpm: 1500, TurnRateDegSec: 3, Mode: "heading", Status: "active", WakeCategory: "medium", PendingClearances: []Clearance{}, LastFixTimes: map[string]float64{}}
}
func preset(mode string) State {
	s := State{Version: Version, ExerciseID: "synthetic-" + mode, Mode: mode, Environment: defaults(), Fixes: []Fix{}, Routes: []Route{}, Areas: []AirspaceArea{}, Aircraft: []Aircraft{}, Strips: map[string]Strip{}, Calls: []Call{}, Reports: []Report{}, Events: []Event{}, Criteria: []Criterion{}, Radio: RadioView{Phase: "idle"}}
	switch mode {
	case "approach":
		s.Title = "Approach • arrival sequencing"
		s.Environment.RangeNm = 35
		s.Fixes = []Fix{{"WEST", "WEST", -28, 0}, {"NORTH", "NORTH", -16, 16}, {"MERGE", "MERGE", -12, 0}, {"FINAL", "FINAL", -5, 0}, {"THR", "THR", -0.75, 0}, {"EAST", "EAST", 10, 0}}
		s.Routes = []Route{{ID: "ARR-W", Name: "WEST ARRIVAL", Kind: "ats", FixIDs: []string{"WEST", "MERGE", "FINAL"}, Active: true, MaxAltitudeFt: 60000}, {ID: "ARR-N", Name: "NORTH ARRIVAL", Kind: "ats", FixIDs: []string{"NORTH", "MERGE", "FINAL"}, Active: true, MaxAltitudeFt: 60000}}
		s.Aircraft = []Aircraft{baseAircraft("p1", "101", -24, 0, 90, 210, 6500), baseAircraft("p2", "102", -16, 14, 180, 200, 7500), baseAircraft("p3", "103", -9, 0, 90, 160, 3000), baseAircraft("p4", "104", -32, 0, 90, 220, 8500)}
		s.Aircraft[0].RouteID = "ARR-W"
		s.Aircraft[0].RouteIndex = 1
		s.Aircraft[0].Mode = "route"
		s.Aircraft[1].RouteID = "ARR-N"
		s.Aircraft[1].RouteIndex = 1
		s.Aircraft[1].Mode = "route"
		s.Aircraft[3].RouteID = "ARR-W"
		s.Aircraft[3].Mode = "route"
		s.Aircraft[3].SpawnTime = 120
		s.Aircraft[3].Status = "scheduled"
	case "aerodrome":
		s.Title = "Aerodrome • runway and circuit"
		s.Environment.RangeNm = 12
		s.Fixes = []Fix{{"FINAL", "FINAL", -5, 0}, {"THR", "THR", -0.75, 0}, {"CROSS", "CROSS", 3, 0}, {"DOWNWIND", "DOWNWIND", 3, -2}, {"BASE", "BASE", -3, -2}}
		s.Routes = []Route{{ID: "CIRCUIT", Name: "LEFT CIRCUIT 09", Kind: "ats", FixIDs: []string{"CROSS", "DOWNWIND", "BASE", "FINAL"}, Active: true, MaxAltitudeFt: 60000}}
		s.Aircraft = []Aircraft{baseAircraft("p1", "101", -5, 0, 90, 120, 1500), baseAircraft("p2", "102", -1.3, -0.7, 90, 0, 0), baseAircraft("p3", "103", 3, -2, 270, 110, 1500)}
		s.Aircraft[1].Mode = "ground"
		s.Aircraft[1].Status = "ground"
		s.Aircraft[1].Type = "C172"
		s.Aircraft[1].WakeCategory = "light"
		s.Aircraft[2].Type = "C172"
		s.Aircraft[2].WakeCategory = "light"
		s.Aircraft[2].Mode = "route"
		s.Aircraft[2].RouteID = "CIRCUIT"
		s.Aircraft[2].RouteIndex = 2
	default:
		s.Mode = "area"
		s.Title = "Area • crossing and longitudinal traffic"
		s.Fixes = []Fix{{"WEST", "WEST", -45, 0}, {"CENTRE", "CENTRE", 0, 0}, {"EAST", "EAST", 45, 0}, {"NORTH", "NORTH", 0, 45}, {"SOUTH", "SOUTH", 0, -45}, {"NORTHEAST", "NORTHEAST", 30, 30}}
		s.Routes = []Route{{ID: "A1", Name: "ATS A1", Kind: "ats", FixIDs: []string{"WEST", "CENTRE", "EAST"}, Active: true, MaxAltitudeFt: 60000}, {ID: "B2", Name: "ATS B2", Kind: "ats", FixIDs: []string{"NORTH", "CENTRE", "SOUTH"}, Active: true, MaxAltitudeFt: 60000}, {ID: "CDR1", Name: "CONDITIONAL C1", Kind: "conditional", FixIDs: []string{"WEST", "NORTHEAST"}, Active: false, AvailableFrom: 300, AvailableUntil: 1800, MinAltitudeFt: 8000, MaxAltitudeFt: 24000}}
		s.Aircraft = []Aircraft{baseAircraft("p1", "101", -30, 0, 90, 360, 12000), baseAircraft("p2", "102", 0, 32, 180, 340, 12000), baseAircraft("p3", "103", -42, 0, 90, 390, 13000), baseAircraft("p4", "104", 0, 44, 180, 320, 15000), baseAircraft("p5", "105", -45, 0, 90, 360, 14000)}
		for i := range s.Aircraft {
			s.Aircraft[i].Mode = "route"
			s.Aircraft[i].RouteID = "A1"
			s.Aircraft[i].RouteIndex = 1
		}
		s.Aircraft[1].RouteID = "B2"
		s.Aircraft[3].RouteID = "B2"
		s.Aircraft[4].SpawnTime = 180
		s.Aircraft[4].Status = "scheduled"
	}
	for _, a := range s.Aircraft {
		s.Strips[a.ID] = Strip{}
	}
	objective := func(id, kind, a, b, unit string, minimum float64, applicability string) Criterion {
		return Criterion{ID: id, Kind: kind, AircraftA: a, AircraftB: b, Unit: unit, Minimum: minimum, Reference: "Instructor exercise setting — verify applicable Doc 4444/local basis", Applicability: applicability, Notes: "Illustrative configurable training objective; not an operational minimum or automatic compliance finding."}
	}
	switch s.Mode {
	case "area":
		s.Criteria = []Criterion{objective("vertical-pair", "vertical", "p1", "p2", "ft", 1000, "Review levels at crossing routes and record the chosen separation method."), objective("same-fix-time", "longitudinal-time", "p1", "p2", "min", 5, "Current-speed estimates at common fix CENTRE; determine applicability from reports and route relationship."), objective("following-distance", "longitudinal-distance", "p1", "p3", "nm", 10, "Along-track distance only while both aircraft follow the same directed route leg."), objective("lateral-method", "lateral", "p1", "p2", "nm", 0, "Record the selected lateral method, protected areas, prerequisites and supporting reports.")}
	case "approach":
		s.Criteria = []Criterion{objective("arrival-order", "approach", "p1", "p2", "min", 4, "Arrival sequencing at common fix; use instructor-confirmed reports and applicable approach procedure."), objective("arrival-levels", "vertical", "p1", "p2", "ft", 1000, "Maintain the assigned altitude arrangement until an applicable alternative is established."), objective("approach-wake", "wake", "p1", "p3", "s", 120, "Instructor selects applicable wake category, runway/approach relationship and required interval; measured only after both runway events.")}
	case "aerodrome":
		s.Criteria = []Criterion{objective("runway-use", "runway", "p1", "p2", "manual", 0, "Review runway occupancy and arrival/departure clearances."), objective("departure-wake", "wake", "p1", "p2", "s", 120, "Confirm the wake categories and applicable arrival/departure conditions; illustrative interval only.")}
	}
	record(&s, "exercise-created", "Synthetic "+s.Mode+" exercise loaded", "")
	return s
}
