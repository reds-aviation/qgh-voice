package procedural

import (
	"fmt"
	"math"
)

func unit(degrees float64) (float64, float64) {
	r := degrees * math.Pi / 180
	return math.Sin(r), math.Cos(r)
}
func bearing(x, y float64) float64 { return normalize(math.Atan2(x, y) * 180 / math.Pi) }
func approach(current, target, step float64) float64 {
	if current < target {
		return math.Min(target, current+step)
	}
	return math.Max(target, current-step)
}
func threshold(s *State) (float64, float64) {
	x, y := unit(s.Environment.RunwayHeadingDeg)
	return -x * s.Environment.RunwayLengthNm / 2, -y * s.Environment.RunwayLengthNm / 2
}
func runwayCoordinates(s *State, a *Aircraft) (along, cross float64) {
	tx, ty := threshold(s)
	ux, uy := unit(s.Environment.RunwayHeadingDeg)
	dx, dy := a.XNm-tx, a.YNm-ty
	return dx*ux + dy*uy, dx*uy - dy*ux
}
func isGround(a *Aircraft) bool {
	switch a.Mode {
	case "ground", "taxi", "line-up":
		return true
	case "takeoff":
		return a.Status == "takeoff-roll"
	case "landing":
		return a.Status == "landed"
	}
	return a.Status == "ground" || a.Status == "landed" || a.Status == "holding-short" || a.Status == "lined-up"
}
func landingGeometry(s *State, a *Aircraft) bool {
	along, cross := runwayCoordinates(s, a)
	return along < -0.1 && along >= -12 && math.Abs(cross) <= 0.8 && math.Abs(deltaHeading(a.HeadingDeg, s.Environment.RunwayHeadingDeg)) <= 30 && a.AltitudeFt > s.Environment.AerodromeElevationFt && a.AltitudeFt <= s.Environment.AerodromeElevationFt+(-along)*318+1000 && a.SpeedKt >= 40 && a.SpeedKt <= 250
}
func routeAvailable(s *State, a *Aircraft, r *Route) bool {
	if !r.Active {
		return false
	}
	if r.Kind == "conditional" {
		return s.Elapsed >= r.AvailableFrom && (r.AvailableUntil == 0 || s.Elapsed < r.AvailableUntil) && a.AltitudeFt >= r.MinAltitudeFt && a.AltitudeFt <= r.MaxAltitudeFt
	}
	return a.AltitudeFt >= r.MinAltitudeFt && a.AltitudeFt <= r.MaxAltitudeFt
}
func turn(a *Aircraft, dt float64) float64 {
	step := a.TurnRateDegSec * dt
	if a.ContinuousTurn {
		if a.TurnDirection == "left" {
			step = -step
		}
		a.HeadingDeg = normalize(a.HeadingDeg + step)
		return step
	}
	d := deltaHeading(a.HeadingDeg, a.TargetHeadingDeg)
	if math.Abs(d) < 1e-9 {
		a.HeadingDeg = normalize(a.TargetHeadingDeg)
		a.TurnDirection = ""
		return 0
	}
	if a.TurnDirection == "left" && d > 0 {
		d -= 360
	}
	if a.TurnDirection == "right" && d < 0 {
		d += 360
	}
	if math.Abs(d) <= step {
		a.HeadingDeg = normalize(a.TargetHeadingDeg)
		a.TurnDirection = ""
		return d
	} else {
		delta := math.Copysign(step, d)
		a.HeadingDeg = normalize(a.HeadingDeg + delta)
		return delta
	}
}

// moveAirSegment integrates constant turn rate and linear speed change in the
// airmass. Wind is added separately, so no-wind arcs retain their exact radius.
func moveAirSegment(a *Aircraft, speedKt, accelerationKtSec, rateDegSec, seconds float64) {
	start := a.HeadingDeg * math.Pi / 180
	rate := rateDegSec * math.Pi / 180
	if math.Abs(rate) < 1e-12 {
		distance := (speedKt*seconds + accelerationKtSec*seconds*seconds/2) / 3600
		a.XNm += math.Sin(start) * distance
		a.YNm += math.Cos(start) * distance
		return
	}
	end := start + rate*seconds
	a.XNm += (speedKt*(math.Cos(start)-math.Cos(end))/rate + accelerationKtSec*(-seconds*math.Cos(end)/rate+(math.Sin(end)-math.Sin(start))/(rate*rate))) / 3600
	a.YNm += (speedKt*(math.Sin(end)-math.Sin(start))/rate + accelerationKtSec*(seconds*math.Sin(end)/rate+(math.Cos(end)-math.Cos(start))/(rate*rate))) / 3600
	a.HeadingDeg = normalize(end * 180 / math.Pi)
}

// Split at the speed target as well as at the heading target. End-step speed
// alone overestimates acceleration distance and changes with callback cadence.
func moveAtRate(a *Aircraft, initialSpeed, targetSpeed, acceleration, signedRate, seconds, offset float64) {
	speed := approach(initialSpeed, targetSpeed, acceleration*offset)
	rampSeconds := math.Min(seconds, math.Abs(targetSpeed-speed)/acceleration)
	if rampSeconds > 0 {
		moveAirSegment(a, speed, math.Copysign(acceleration, targetSpeed-speed), signedRate, rampSeconds)
	}
	if seconds > rampSeconds {
		moveAirSegment(a, targetSpeed, 0, signedRate, seconds-rampSeconds)
	}
}

func moveHeading(a *Aircraft, dt, initialSpeed, targetSpeed, acceleration float64) {
	start := a.HeadingDeg
	delta := turn(a, dt)
	end := a.HeadingDeg
	a.HeadingDeg = start
	turnSeconds := math.Min(dt, math.Abs(delta)/a.TurnRateDegSec)
	if turnSeconds > 0 {
		moveAtRate(a, initialSpeed, targetSpeed, acceleration, math.Copysign(a.TurnRateDegSec, delta), turnSeconds, 0)
	}
	if dt > turnSeconds {
		moveAtRate(a, initialSpeed, targetSpeed, acceleration, 0, dt-turnSeconds, turnSeconds)
	}
	a.HeadingDeg = end
}

func speedDistance(initial, target, acceleration, dt float64) (float64, float64) {
	rampSeconds := math.Min(dt, math.Abs(target-initial)/acceleration)
	end := approach(initial, target, acceleration*dt)
	distance := ((initial+end)*rampSeconds/2 + target*(dt-rampSeconds)) / 3600
	return end, distance
}

func driftWithWind(s *State, a *Aircraft, dt float64) {
	wx, wy := unit(s.Environment.WindDirectionDeg + 180)
	a.XNm += wx * s.Environment.WindSpeedKt * dt / 3600
	a.YNm += wy * s.Environment.WindSpeedKt * dt / 3600
}
func segmentDistance(px, py, x1, y1, x2, y2 float64) float64 {
	dx, dy := x2-x1, y2-y1
	if dx*dx+dy*dy < 1e-16 {
		return math.Hypot(px-x1, py-y1)
	}
	t := ((px-x1)*dx + (py-y1)*dy) / (dx*dx + dy*dy)
	t = math.Max(0, math.Min(1, t))
	return math.Hypot(px-(x1+t*dx), py-(y1+t*dy))
}

// advance uses bounded substeps and splits at timed activations, conditions and
// route windows, so a long instructor step cannot execute a condition early.
func advance(s *State, seconds float64) {
	if s.Terminated {
		return
	}
	end := math.Min(s.Elapsed+seconds, 604800)
	for s.Elapsed < end-1e-9 {
		dt := math.Min(0.25, end-s.Elapsed)
		for _, a := range s.Aircraft {
			if a.Status == "scheduled" && a.SpawnTime > s.Elapsed && a.SpawnTime < s.Elapsed+dt {
				dt = a.SpawnTime - s.Elapsed
			}
			for _, c := range a.PendingClearances {
				if c.Condition != nil && c.Condition.Kind == "time" && c.Condition.At > s.Elapsed && c.Condition.At < s.Elapsed+dt {
					dt = c.Condition.At - s.Elapsed
				}
			}
			if a.Status != "scheduled" && !isGround(&a) && a.Mode != "landing" && a.Mode != "stopped" && a.VerticalRateFpm > 0 {
				reaching := math.Abs(a.TargetAltitudeFt-a.AltitudeFt) * 60 / a.VerticalRateFpm
				if reaching > 1e-9 && reaching < dt {
					dt = reaching
				}
			}
			if a.Status != "scheduled" && a.Mode == "hold" && a.Hold != nil {
				h := a.Hold
				boundary := math.Inf(1)
				switch h.Phase {
				case "outbound":
					boundary = h.LegSeconds - h.PhaseElapsed
				case "turn-outbound", "turn-inbound":
					target := h.InboundCourseDeg
					if h.Phase == "turn-outbound" {
						target = normalize(target + 180)
					}
					remaining := normalize(target - a.HeadingDeg)
					if h.Direction == "left" {
						remaining = normalize(a.HeadingDeg - target)
					}
					boundary = remaining / a.TurnRateDegSec
				}
				if boundary > 1e-9 && boundary < dt {
					dt = boundary
				}
			}
		}
		for _, r := range s.Routes {
			for _, boundary := range []float64{r.AvailableFrom, r.AvailableUntil} {
				if boundary > s.Elapsed && boundary < s.Elapsed+dt {
					dt = boundary - s.Elapsed
				}
			}
		}
		for i := range s.Aircraft {
			a := &s.Aircraft[i]
			if a.Status == "scheduled" {
				if a.SpawnTime > s.Elapsed+1e-9 {
					continue
				}
				a.Status = "active"
				if isGround(a) {
					a.Status = "ground"
				}
				record(s, "aircraft-activated", a.Callsign+" entered the exercise", a.ID)
				emitPilot(s, a, positionReport(s, a), "entry")
			}
			applyDue(s, a, "")
			moveAircraft(s, a, dt)
		}
		s.Elapsed += dt
		for i := range s.Aircraft {
			a := &s.Aircraft[i]
			if a.Status == "scheduled" && a.SpawnTime <= s.Elapsed+1e-9 {
				a.Status = "active"
				if isGround(a) {
					a.Status = "ground"
				}
				record(s, "aircraft-activated", a.Callsign+" entered the exercise", a.ID)
				emitPilot(s, a, positionReport(s, a), "entry")
			}
			if a.Status != "scheduled" {
				applyDue(s, a, "")
			}
		}
	}
	if s.Elapsed >= 604800 {
		s.Running = false
	}
}
func applyDue(s *State, a *Aircraft, fixID string) {
	pending := a.PendingClearances
	a.PendingClearances = []Clearance{}
	for _, c := range pending {
		if c.Condition == nil {
			continue
		}
		due := (c.Condition.Kind == "time" && s.Elapsed+1e-9 >= c.Condition.At) || (c.Condition.Kind == "fix" && fixID != "" && c.Condition.FixID == fixID)
		if !due {
			a.PendingClearances = append(a.PendingClearances, c)
			continue
		}
		c.Condition = nil
		text := clearanceText(s, a, c)
		if e := applyClearance(s, a, c); e != nil {
			record(s, "clearance-not-executed", a.Callsign+": armed clearance could not execute: "+e.Error(), a.ID)
			emitPilot(s, a, a.Callsign+", unable, "+e.Error()+".", "unable")
		} else {
			record(s, "clearance-executed", text, a.ID)
			emitPilot(s, a, text, "execution")
		}
	}
}
func crossedFix(s *State, a *Aircraft, f *Fix) {
	if last, ok := a.LastFixTimes[f.ID]; ok && s.Elapsed-last < 10 {
		return
	}
	if a.LastFixTimes == nil {
		a.LastFixTimes = map[string]float64{}
	}
	a.LastFixTimes[f.ID] = s.Elapsed
	text := fmt.Sprintf("%s, %s at elapsed %s, %s.", a.Callsign, f.Name, formatTime(s.Elapsed), altitudeReport(s, a))
	emitPilot(s, a, text, "fix-report")
	applyDue(s, a, f.ID)
}
func moveAircraft(s *State, a *Aircraft, dt float64) {
	if a.Mode == "stopped" || a.Mode == "ground" {
		return
	}
	if a.Mode == "taxi" || a.Mode == "line-up" {
		moveGround(s, a, dt)
		return
	}
	if a.Mode == "takeoff" && a.Status == "takeoff-roll" {
		moveTakeoff(s, a, dt)
		return
	}
	if a.Mode == "landing" {
		moveLanding(s, a, dt)
		return
	}
	previousAltitude := a.AltitudeFt
	a.AltitudeFt = approach(a.AltitudeFt, a.TargetAltitudeFt, a.VerticalRateFpm*dt/60)
	reachedAltitude := previousAltitude != a.TargetAltitudeFt && a.AltitudeFt == a.TargetAltitudeFt
	initialSpeed := a.SpeedKt
	a.SpeedKt = approach(a.SpeedKt, a.TargetSpeedKt, 5*dt)
	var fix *Fix
	if a.Mode == "route" {
		r := findRoute(s, a.RouteID)
		if r == nil {
			a.Mode = "heading"
		} else if !routeAvailable(s, a, r) {
			if a.Status != "blocked" {
				a.TargetHeadingDeg = a.HeadingDeg
				a.TurnDirection = ""
				a.ContinuousTurn = false
				record(s, "route-unavailable", a.Callsign+" continuing current heading: "+r.Name+" is unavailable; instructor clearance required", a.ID)
				continuation := fmt.Sprintf(", continuing heading %03.0f, request instructions.", normalize(math.Round(a.HeadingDeg)))
				if a.CompassUnserviceable {
					continuation = ", continuing present heading, request instructions."
				}
				emitPilot(s, a, a.Callsign+", unable route "+r.Name+continuation, "unable")
			}
			a.Status = "blocked"
		} else {
			if a.Status == "blocked" {
				a.Status = "active"
				record(s, "route-available", a.Callsign+" continuing on "+r.Name, a.ID)
			}
			if a.RouteIndex >= len(r.FixIDs) {
				a.Mode = "heading"
				a.TargetHeadingDeg = a.HeadingDeg
				record(s, "route-completed", a.Callsign+" completed route", a.ID)
			} else {
				fix = findFix(s, r.FixIDs[a.RouteIndex])
			}
		}
	} else if a.Mode == "direct" {
		fix = findFix(s, a.DirectFixID)
	} else if a.Mode == "hold" {
		fix = holdGuidance(s, a, dt)
	}
	if fix != nil {
		a.TargetHeadingDeg = bearing(fix.XNm-a.XNm, fix.YNm-a.YNm)
		a.TurnDirection = ""
	}
	oldX, oldY := a.XNm, a.YNm
	if a.Orbit != nil {
		moveOrbit(s, a, dt, initialSpeed)
	} else {
		moveHeading(a, dt, initialSpeed, a.TargetSpeedKt, 5)
	}
	driftWithWind(s, a, dt)
	if a.Mode == "hold" && a.Hold != nil {
		a.Hold.PhaseElapsed += dt
		completeHoldPhase(a)
	}
	if math.Abs(a.XNm) > 2000 || math.Abs(a.YNm) > 2000 {
		a.XNm = math.Max(-2000, math.Min(2000, a.XNm))
		a.YNm = math.Max(-2000, math.Min(2000, a.YNm))
		a.Mode = "stopped"
		a.Status = "stopped"
		a.SpeedKt = 0
		a.TargetSpeedKt = 0
		a.Orbit = nil
		record(s, "exercise-boundary", a.Callsign+" stopped at model boundary", a.ID)
		return
	}
	if reachedAltitude {
		// Reports describe the bounded physical sample at the end of this
		// movement, not the older start-of-step position and clock.
		startTime := s.Elapsed
		s.Elapsed += dt
		emitPilot(s, a, a.Callsign+", maintaining "+altitudeReport(s, a)+".", "level-report")
		s.Elapsed = startTime
	}
	reached := ""
	if fix != nil && segmentDistance(fix.XNm, fix.YNm, oldX, oldY, a.XNm, a.YNm) <= math.Max(0.04, a.SpeedKt*dt/3600*0.6) {
		reached = fix.ID
		if a.Mode == "route" {
			a.RouteIndex++
		} else if a.Mode == "direct" {
			a.Mode = "heading"
			a.TargetHeadingDeg = a.HeadingDeg
			a.DirectFixID = ""
		} else if a.Mode == "hold" && a.Hold != nil {
			a.Hold.Phase = "turn-outbound"
			a.Hold.PhaseElapsed = 0
			a.TargetHeadingDeg = normalize(a.Hold.InboundCourseDeg + 180)
			a.TurnDirection = a.Hold.Direction
		}
		crossedFix(s, a, fix)
	}
	// A condition may refer to an unassigned crossing fix. Capture the crossing
	// using the segment, not the end point alone.
	for i := range s.Fixes {
		f := &s.Fixes[i]
		if f.ID == reached {
			continue
		}
		if segmentDistance(f.XNm, f.YNm, oldX, oldY, a.XNm, a.YNm) <= 0.04 && math.Hypot(oldX-f.XNm, oldY-f.YNm) > 0.04 {
			crossedFix(s, a, f)
		}
	}
}

// moveOrbit integrates the circular arc at the selected turn rate. A requested
// exit completes this lap, then flies any remaining step on the entry heading.
func moveOrbit(s *State, a *Aircraft, dt, initialSpeed float64) {
	o := a.Orbit
	turnSeconds := dt
	remaining := math.Inf(1)
	if o.ExitRequested {
		remaining = (360 - o.Degrees) / a.TurnRateDegSec
		if o.Degrees < 1e-9 {
			remaining = 0
		}
		turnSeconds = math.Min(dt, remaining)
	}
	rate := a.TurnRateDegSec
	if o.Direction == "left" {
		rate = -rate
	}
	moveAtRate(a, initialSpeed, a.TargetSpeedKt, 5, rate, turnSeconds, 0)
	total := o.Degrees + a.TurnRateDegSec*turnSeconds
	o.Laps += int(math.Floor((total + 1e-9) / 360))
	o.Degrees = math.Mod(total, 360)
	if o.Degrees < 1e-9 || o.Degrees > 360-1e-9 {
		o.Degrees = 0
	}
	if remaining <= dt+1e-9 {
		a.HeadingDeg, a.TargetHeadingDeg = o.EntryHeadingDeg, o.EntryHeadingDeg
		a.Orbit = nil
		a.Mode, a.TurnDirection = "heading", ""
		moveAtRate(a, initialSpeed, a.TargetSpeedKt, 5, 0, dt-turnSeconds, turnSeconds)
		emitPilot(s, a, a.Callsign+", orbit complete, resuming entry heading.", "orbit-report")
	}
}
func completeHoldPhase(a *Aircraft) {
	h := a.Hold
	if h == nil {
		return
	}
	for {
		switch h.Phase {
		case "turn-outbound":
			if math.Abs(deltaHeading(a.HeadingDeg, normalize(h.InboundCourseDeg+180))) > 1e-9 {
				return
			}
			h.Phase, h.PhaseElapsed = "outbound", 0
			a.TurnDirection = ""
		case "outbound":
			if h.PhaseElapsed < h.LegSeconds-1e-9 {
				return
			}
			h.Phase, h.PhaseElapsed = "turn-inbound", 0
			a.TargetHeadingDeg, a.TurnDirection = h.InboundCourseDeg, h.Direction
		case "turn-inbound":
			if math.Abs(deltaHeading(a.HeadingDeg, h.InboundCourseDeg)) > 1e-9 {
				return
			}
			h.Phase, h.PhaseElapsed = "inbound", 0
			a.TurnDirection = ""
		default:
			return
		}
	}
}

func holdGuidance(s *State, a *Aircraft, dt float64) *Fix {
	h := a.Hold
	if h == nil {
		a.Mode = "heading"
		return nil
	}
	a.Status = "holding"
	completeHoldPhase(a)
	switch h.Phase {
	case "entry", "inbound":
		return findFix(s, h.FixID)
	case "turn-outbound":
		a.TargetHeadingDeg = normalize(h.InboundCourseDeg + 180)
		a.TurnDirection = h.Direction
	case "outbound":
		a.TargetHeadingDeg = normalize(h.InboundCourseDeg + 180)
	case "turn-inbound":
		a.TargetHeadingDeg = h.InboundCourseDeg
		a.TurnDirection = h.Direction
	}
	return nil
}
func moveGround(s *State, a *Aircraft, dt float64) {
	if a.Status == "holding-short" || a.Status == "lined-up" {
		return
	}
	dx, dy := a.GroundTargetX-a.XNm, a.GroundTargetY-a.YNm
	distance := math.Hypot(dx, dy)
	var travel float64
	a.SpeedKt, travel = speedDistance(a.SpeedKt, a.TargetSpeedKt, 3, dt)
	if distance <= math.Max(travel, 0.005) {
		a.XNm = a.GroundTargetX
		a.YNm = a.GroundTargetY
		a.SpeedKt = 0
		a.TargetSpeedKt = 0
		a.AltitudeFt = s.Environment.AerodromeElevationFt
		if a.Mode == "line-up" {
			a.HeadingDeg = normalize(s.Environment.RunwayHeadingDeg)
			a.TargetHeadingDeg = a.HeadingDeg
			a.Status = "lined-up"
			emitPilot(s, a, a.Callsign+", lined up and waiting.", "ground-report")
		} else {
			a.Status = "holding-short"
			emitPilot(s, a, a.Callsign+", holding short of the runway.", "ground-report")
		}
		return
	}
	a.HeadingDeg = bearing(dx, dy)
	a.TargetHeadingDeg = a.HeadingDeg
	a.XNm += dx / distance * travel
	a.YNm += dy / distance * travel
	a.AltitudeFt = s.Environment.AerodromeElevationFt
}
func moveTakeoff(s *State, a *Aircraft, dt float64) {
	var travel float64
	a.SpeedKt, travel = speedDistance(a.SpeedKt, a.TargetSpeedKt, 8, dt)
	ux, uy := unit(s.Environment.RunwayHeadingDeg)
	a.XNm += ux * travel
	a.YNm += uy * travel
	a.RunwayProgress += travel
	rotateSpeed := 110.0
	if a.WakeCategory == "light" {
		rotateSpeed = 65
	}
	if a.SpeedKt >= rotateSpeed && a.RunwayProgress >= math.Min(0.5, s.Environment.RunwayLengthNm*0.5) {
		a.Mode = "heading"
		a.Status = "active"
		a.TargetSpeedKt = 180
		a.TargetHeadingDeg = a.HeadingDeg
		a.AltitudeFt = s.Environment.AerodromeElevationFt + 1
		emitPilot(s, a, a.Callsign+", airborne.", "departure")
	} else if a.RunwayProgress >= s.Environment.RunwayLengthNm {
		a.Mode = "stopped"
		a.Status = "stopped"
		a.SpeedKt = 0
		a.TargetSpeedKt = 0
		record(s, "runway-overrun", a.Callsign+" stopped at runway end before rotation", a.ID)
	}
}
func moveLanding(s *State, a *Aircraft, dt float64) {
	along, _ := runwayCoordinates(s, a)
	ux, uy := unit(s.Environment.RunwayHeadingDeg)
	if a.Status == "landed" {
		var travel float64
		a.SpeedKt, travel = speedDistance(a.SpeedKt, 0, 5, dt)
		a.XNm += ux * travel
		a.YNm += uy * travel
		a.RunwayProgress += travel
		if a.RunwayProgress >= s.Environment.RunwayLengthNm || a.SpeedKt <= 0.1 {
			a.SpeedKt = 0
			a.TargetSpeedKt = 0
			a.Mode = "ground"
			a.Status = "landed"
			emitPilot(s, a, a.Callsign+", landing roll complete, on runway.", "ground-report")
		}
		return
	}
	tx, ty := threshold(s)
	a.TargetHeadingDeg = bearing(tx-a.XNm, ty-a.YNm)
	a.TurnDirection = ""
	initialSpeed := a.SpeedKt
	targetSpeed := math.Max(65, a.TargetSpeedKt)
	a.SpeedKt = approach(a.SpeedKt, targetSpeed, 3*dt)
	pathAltitude := s.Environment.AerodromeElevationFt + math.Max(0, -along)*318
	a.TargetAltitudeFt = pathAltitude
	a.AltitudeFt = approach(a.AltitudeFt, pathAltitude, math.Max(a.VerticalRateFpm, 1200)*dt/60)
	moveHeading(a, dt, initialSpeed, targetSpeed, 3)
	driftWithWind(s, a, dt)
	newAlong, cross := runwayCoordinates(s, a)
	if newAlong >= 0 {
		if math.Abs(cross) > 0.1 || a.AltitudeFt > s.Environment.AerodromeElevationFt+100 {
			a.Mode = "go-around"
			a.Status = "active"
			a.TargetAltitudeFt = s.Environment.AerodromeElevationFt + 3000
			a.TargetSpeedKt = 180
			a.TargetHeadingDeg = normalize(s.Environment.RunwayHeadingDeg)
			emitPilot(s, a, a.Callsign+", going around, approach not stabilised.", "go-around")
			return
		}
		a.AltitudeFt = s.Environment.AerodromeElevationFt
		a.TargetAltitudeFt = a.AltitudeFt
		a.HeadingDeg = normalize(s.Environment.RunwayHeadingDeg)
		a.TargetHeadingDeg = a.HeadingDeg
		a.Status = "landed"
		a.TargetSpeedKt = 0
		a.RunwayProgress = newAlong
		emitPilot(s, a, a.Callsign+", landed.", "arrival")
	}
}
