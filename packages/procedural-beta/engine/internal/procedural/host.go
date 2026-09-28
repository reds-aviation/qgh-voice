package procedural

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"sync"
	"time"
)

type radioSession struct {
	Ends         time.Time
	HoldUntil    time.Time
	HoldDuration time.Duration
	Last         *DFView
}
type Host struct {
	mu       sync.Mutex
	state    State
	db       *sql.DB
	browser  *browserRegistry
	now      func() time.Time
	lastWall time.Time
	radio    *radioSession
	fault    bool
	closed   bool
}

func Open(path string) (*Host, error) {
	db, e := sql.Open("sqlite", path)
	if e != nil {
		return nil, e
	}
	db.SetMaxOpenConns(1)
	ok := false
	defer func() {
		if !ok {
			db.Close()
		}
	}()
	if _, e = db.Exec("PRAGMA busy_timeout=1000; PRAGMA locking_mode=EXCLUSIVE; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;"); e != nil {
		return nil, e
	}
	var version int
	if e = db.QueryRow("PRAGMA user_version").Scan(&version); e != nil {
		return nil, e
	}
	if version == 0 {
		var count int
		if e = db.QueryRow("SELECT count(*) FROM sqlite_master WHERE type='table'").Scan(&count); e != nil {
			return nil, e
		}
		if count != 0 {
			return nil, errors.New("unrecognised database; existing contents preserved")
		}
		tx, err := db.Begin()
		if err != nil {
			return nil, err
		}
		defer tx.Rollback()
		if _, err = tx.Exec("CREATE TABLE procedural_checkpoint (id INTEGER PRIMARY KEY CHECK(id=1), state TEXT NOT NULL); CREATE TABLE procedural_commands (id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, receipt TEXT NOT NULL); PRAGMA user_version=1;"); err != nil {
			return nil, err
		}
		if err = tx.Commit(); err != nil {
			return nil, err
		}
	} else if version != Version {
		return nil, fmt.Errorf("unsupported procedural database version %d", version)
	}
	h := &Host{db: db, now: time.Now}
	h.lastWall = h.now()
	var raw string
	e = db.QueryRow("SELECT state FROM procedural_checkpoint WHERE id=1").Scan(&raw)
	if e == sql.ErrNoRows {
		h.state = preset("area")
		h.state.ExerciseID = "exercise-" + rand.Text()
	} else if e != nil {
		return nil, e
	} else {
		if e = decode([]byte(raw), &h.state); e != nil {
			return nil, e
		}
		if h.state.ExerciseID == "" {
			h.state.ExerciseID = "exercise-" + rand.Text()
		}
		if e = validateState(&h.state); e != nil {
			return nil, fmt.Errorf("invalid saved procedural exercise: %w", e)
		}
		h.state.Running = false
		h.state.Radio = RadioView{Phase: "idle"}
		record(&h.state, "recovered-paused", "Saved exercise recovered paused; radio cleared", "")
		h.state.Revision++
	}
	if e = h.save(h.state, nil, "", Receipt{}); e != nil {
		return nil, e
	}
	ok = true
	return h, nil
}
func clone(s State) State {
	b, _ := json.Marshal(s)
	var out State
	json.Unmarshal(b, &out)
	return out
}
func (h *Host) save(s State, c *Command, fingerprint string, r Receipt) error {
	if h.browser != nil {
		if c != nil {
			if len(h.browser.Receipts) >= 50000 {
				return errors.New("browser command journal full; export this exercise")
			}
			h.browser.Receipts[c.ID] = browserReceipt{Fingerprint: fingerprint, Receipt: r}
		}
		return nil // The worker durably commits the complete checkpoint before acknowledgement.
	}
	raw, e := json.Marshal(s)
	if e != nil {
		return e
	}
	tx, e := h.db.Begin()
	if e != nil {
		return e
	}
	defer tx.Rollback()
	if _, e = tx.Exec("INSERT INTO procedural_checkpoint(id,state) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET state=excluded.state", string(raw)); e != nil {
		return e
	}
	if c != nil {
		receipt, e := json.Marshal(r)
		if e != nil {
			return e
		}
		if _, e = tx.Exec("INSERT INTO procedural_commands(id,fingerprint,receipt) VALUES(?,?,?)", c.ID, fingerprint, string(receipt)); e != nil {
			return e
		}
	}
	return tx.Commit()
}
func (h *Host) fail() {
	h.fault = true
	h.state.Running = false
	h.radio = nil
	h.state.Radio.Phase = "idle"
	h.state.Radio.RemainingMs = 0
}
func (h *Host) Close() error {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.closed {
		return nil
	}
	h.syncLocked(h.now())
	h.closed = true
	if h.browser != nil {
		return nil
	}
	return h.db.Close()
}
func (h *Host) Run(ctx context.Context) {
	timer := time.NewTicker(100 * time.Millisecond)
	defer timer.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-timer.C:
			h.mu.Lock()
			if h.closed {
				h.mu.Unlock()
				return
			}
			h.syncLocked(h.now())
			h.mu.Unlock()
		}
	}
}
func fingerprint(c Command, role string) (string, error) {
	var p any
	if e := json.Unmarshal(c.Payload, &p); e != nil {
		return "", errors.New("invalid JSON payload")
	}
	b, e := json.Marshal(struct {
		Type, AircraftID, Role string
		Payload                any
		ExerciseID             string `json:"ExerciseID,omitempty"`
	}{c.Type, c.AircraftID, role, p, c.ExerciseID})
	if e != nil {
		return "", e
	}
	sum := sha256.Sum256(b)
	return hex.EncodeToString(sum[:]), nil
}

func (h *Host) Submit(c Command, role string) (any, error) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.closed || h.fault {
		return nil, errors.New("recording unavailable; exercise paused")
	}
	if role != "student" && role != "instructor" {
		return nil, errors.New("invalid role")
	}
	if role == "student" && c.Type != "strip" && c.Type != "controller-call" {
		return nil, errors.New("only the instructor can change the traffic exercise")
	}
	if !validID(c.ID) || len(c.Payload) > 4*1024*1024 {
		return nil, errors.New("command requires a unique ID of at most 64 letters, digits, hyphens or underscores and a bounded payload")
	}
	if c.ExerciseID != "" && !validID(c.ExerciseID) {
		return nil, errors.New("invalid command exercise identity")
	}
	if len(c.Payload) == 0 {
		c.Payload = json.RawMessage("{}")
	}
	fp, e := fingerprint(c, role)
	if e != nil {
		return nil, e
	}
	var previousFP, previousReceipt string
	if h.browser != nil {
		e = sql.ErrNoRows
		if previous, found := h.browser.Receipts[c.ID]; found {
			previousFP = previous.Fingerprint
			raw, _ := json.Marshal(previous.Receipt)
			previousReceipt, e = string(raw), nil
		}
	} else {
		e = h.db.QueryRow("SELECT fingerprint,receipt FROM procedural_commands WHERE id=?", c.ID).Scan(&previousFP, &previousReceipt)
	}
	if e == nil {
		if previousFP != fp {
			return nil, errors.New("command ID already used for different contents or role")
		}
		var r Receipt
		if e = json.Unmarshal([]byte(previousReceipt), &r); e != nil {
			return nil, e
		}
		return r, nil
	}
	if e != sql.ErrNoRows {
		h.fail()
		return nil, errors.New("cannot read command registry; exercise paused")
	}
	if c.ExerciseID != "" && c.ExerciseID != h.state.ExerciseID {
		return nil, errors.New("exercise was replaced; refresh before submitting an instruction or strip")
	}
	now := h.now()
	h.syncLocked(now)
	if h.fault {
		return nil, errors.New("recording unavailable; exercise paused")
	}
	s := clone(h.state)
	efx, e := apply(&s, c, role)
	if e != nil {
		return nil, e
	}
	if e = validateState(&s); e != nil {
		return nil, e
	}
	s.Revision = h.state.Revision + 1
	r := Receipt{ID: c.ID, Revision: s.Revision, Accepted: true}
	if e = h.save(s, &c, fp, r); e != nil {
		h.fail()
		return nil, errors.New("recording unavailable; command was not acknowledged; exercise paused")
	}
	previousRadio := h.state.Radio.ID
	h.state = s
	h.lastWall = now
	if efx.ClearRadio {
		h.radio = nil
		h.state.Radio = RadioView{Phase: "idle"}
	} else if efx.Interrupt {
		h.interruptLocked(now)
	} else if h.state.Radio.ID != "" && h.state.Radio.ID != previousRadio {
		h.startRadioLocked(now, efx.Duration)
	}
	return r, nil
}

// syncLocked uses monotonic wall time. It captures the bearing at transmission
// release even when a timer callback arrives after that boundary.
func (h *Host) syncLocked(now time.Time) {
	if h.closed || h.fault {
		return
	}
	if now.Before(h.lastWall) {
		h.lastWall = now
		return
	}
	if h.radio != nil && h.radio.Ends.After(h.lastWall) && !h.radio.Ends.After(now) {
		h.advanceWallLocked(h.radio.Ends)
		if h.radio != nil {
			h.radio.Last = h.observeLocked("hold", h.radio.HoldUntil.Sub(now).Milliseconds())
		}
	}
	h.advanceWallLocked(now)
	if h.radio != nil && now.Before(h.radio.Ends) {
		h.radio.Last = h.observeLocked("transmitting", h.radio.Ends.Sub(now).Milliseconds())
	}
	if h.radio != nil && !now.Before(h.radio.HoldUntil) {
		h.radio = nil
	}
}
func (h *Host) advanceWallLocked(now time.Time) {
	dt := now.Sub(h.lastWall).Seconds()
	if dt <= 0 {
		return
	}
	h.lastWall = now
	if !h.state.Running || h.fault {
		return
	}
	s := clone(h.state)
	previousRadio := s.Radio.ID
	advance(&s, dt)
	s.Revision++
	if e := h.save(s, nil, "", Receipt{}); e != nil {
		h.fail()
		return
	}
	h.state = s
	if s.Radio.ID != "" && s.Radio.ID != previousRadio {
		h.startRadioLocked(now, 0)
	}
}
func (h *Host) startRadioLocked(now time.Time, duration float64) {
	if duration == 0 {
		duration = math.Max(3, math.Min(30, float64(len(h.state.Radio.Text))/12+1))
	}
	ends := now.Add(time.Duration(duration * float64(time.Second)))
	hold := time.Duration(h.state.Environment.DFHoldSeconds * float64(time.Second))
	h.radio = &radioSession{Ends: ends, HoldUntil: ends.Add(hold), HoldDuration: hold}
	h.radio.Last = h.observeLocked("transmitting", ends.Sub(now).Milliseconds())
}
func (h *Host) interruptLocked(now time.Time) {
	if h.radio == nil || !now.Before(h.radio.Ends) {
		return
	}
	last := h.observeLocked("hold", h.radio.HoldDuration.Milliseconds())
	h.radio.Ends = now
	h.radio.HoldUntil = now.Add(h.radio.HoldDuration)
	h.radio.Last = last
}
func (h *Host) observeLocked(phase string, remaining int64) *DFView {
	a := findAircraft(&h.state, h.state.Radio.AircraftID)
	variation, reference, available := magneticReference(h.state.Environment)
	v := &DFView{Source: h.state.Radio.AircraftID, Callsign: h.state.Radio.Callsign, Phase: phase, RemainingMs: max(0, remaining), MagneticReference: reference}
	if a == nil || a.Status == "scheduled" || isGround(a) || math.Hypot(a.XNm-h.state.Environment.StationXNm, a.YNm-h.state.Environment.StationYNm) <= 0.25 {
		return v
	}
	qte := bearing(a.XNm-h.state.Environment.StationXNm, a.YNm-h.state.Environment.StationYNm)
	qdm := normalize(qte + 180 - variation)
	v.QTE = &qte
	if available {
		v.QDM = &qdm
		v.MagneticVariationDeg = &variation
	}
	v.Valid = true
	return v
}
func magneticReference(e Environment) (float64, string, bool) {
	if e.MagneticVariationKnown == nil || *e.MagneticVariationKnown {
		return e.MagneticVariationDeg, "configured", true
	}
	if e.TrainingMagneticVariationDeg != nil {
		return *e.TrainingMagneticVariationDeg, "training", true
	}
	return 0, "unavailable", false
}
func (h *Host) radioViewLocked(now time.Time) (RadioView, *DFView) {
	r := h.state.Radio
	r.Phase = "idle"
	r.RemainingMs = 0
	if h.radio == nil {
		return r, nil
	}
	v := h.radio.Last
	if v == nil {
		return r, nil
	}
	copyDF := *v
	if now.Before(h.radio.Ends) {
		r.Phase = "transmitting"
		r.RemainingMs = max(0, h.radio.Ends.Sub(now).Milliseconds())
	} else {
		r.Phase = "hold"
		r.RemainingMs = max(0, h.radio.HoldUntil.Sub(now).Milliseconds())
	}
	copyDF.Phase = r.Phase
	copyDF.RemainingMs = r.RemainingMs
	return r, &copyDF
}
func (h *Host) View(role string) any {
	h.mu.Lock()
	defer h.mu.Unlock()
	now := h.now()
	h.syncLocked(now)
	s := clone(h.state)
	radio, df := h.radioViewLocked(now)
	v := StudentView{Version: Version, ExerciseID: s.ExerciseID, Role: role, Available: !h.fault && !h.closed, Revision: s.Revision, Elapsed: s.Elapsed, Running: s.Running, Terminated: s.Terminated, Mode: s.Mode, Title: s.Title, Environment: s.Environment, Fixes: s.Fixes, Routes: s.Routes, Areas: s.Areas, Roster: []RosterEntry{}, Strips: s.Strips, Radio: radio, DF: df, Calls: s.Calls, Reports: s.Reports, Criteria: s.Criteria}
	v.ScopeDisplay = s.ScopeDisplay
	for _, a := range s.Aircraft {
		if role == "instructor" || a.Status != "scheduled" {
			v.Roster = append(v.Roster, RosterEntry{a.ID, a.Callsign, a.Type, a.RouteID, a.Status})
		}
	}
	if role == "instructor" {
		return InstructorView{StudentView: v, Aircraft: s.Aircraft, Events: s.Events, Alerts: alerts(&s)}
	}
	// Scheduled aircraft identities, manual strips and future pairings are hidden.
	visible := map[string]bool{}
	hidden := map[string]bool{}
	for _, a := range s.Aircraft {
		if a.Status == "scheduled" {
			hidden[a.ID] = true
		}
	}
	for _, r := range v.Roster {
		visible[r.ID] = true
	}
	for id := range v.Strips {
		if !visible[id] {
			delete(v.Strips, id)
		}
	}
	criteria := []Criterion{}
	for _, c := range v.Criteria {
		if visible[c.AircraftA] && visible[c.AircraftB] {
			criteria = append(criteria, c)
		}
	}
	v.Criteria = criteria
	v.Calls = []Call{}
	for _, c := range s.Calls {
		if !hidden[c.AircraftID] {
			v.Calls = append(v.Calls, c)
		}
	}
	v.Reports = []Report{}
	for _, r := range s.Reports {
		if !hidden[r.AircraftID] {
			v.Reports = append(v.Reports, r)
		}
	}
	if hidden[v.Radio.AircraftID] {
		v.Radio = RadioView{Phase: "idle"}
		v.DF = nil
	}
	return v
}
func (h *Host) Export() any {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.syncLocked(h.now())
	s := clone(h.state)
	s.Running = false
	s.Radio = RadioView{Phase: "idle"}
	return Exported{Version: Version, Scenario: s}
}
