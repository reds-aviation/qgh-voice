package procedural

import (
	"bytes"
	"encoding/json"
	"fmt"
	"strings"
	"testing"
)

func trafficSetupPayload(t *testing.T, count int) json.RawMessage {
	t.Helper()
	aircraft := make([]map[string]any, count)
	for i := range aircraft {
		aircraft[i] = map[string]any{"id": fmt.Sprintf("ac%d", i+1), "callsign": fmt.Sprint(101 + i), "qteDeg": float64(i) * 15, "rangeNm": 25 + i, "headingDeg": 180, "speedKt": 240, "altitudeFt": 10000 + i*500}
	}
	payload, err := json.Marshal(map[string]any{"title": "Traffic capacity", "mode": "area", "aircraft": aircraft})
	if err != nil {
		t.Fatal(err)
	}
	return payload
}

func checkpointForTest(t *testing.T, h *Host) []byte {
	t.Helper()
	raw, err := h.BrowserCheckpoint()
	if err != nil {
		t.Fatal(err)
	}
	return raw
}

func TestNewTrafficSetupAccepts20AndRejects21Atomically(t *testing.T) {
	h, err := OpenBrowser(nil)
	if err != nil {
		t.Fatal(err)
	}
	_, err = h.Submit(Command{ID: "setup-20", ExerciseID: h.state.ExerciseID, Type: "scenario-setup", Payload: trafficSetupPayload(t, 20)}, "instructor")
	if err != nil || len(h.state.Aircraft) != 20 || h.state.Running || h.state.Elapsed != 0 {
		t.Fatalf("20-aircraft setup was not accepted paused: %v", err)
	}
	before := checkpointForTest(t, h)
	_, err = h.Submit(Command{ID: "setup-21", ExerciseID: h.state.ExerciseID, Type: "scenario-setup", Payload: trafficSetupPayload(t, 21)}, "instructor")
	if err == nil || !strings.Contains(err.Error(), "20 aircraft") {
		t.Fatalf("21-aircraft setup should report the new 20-aircraft limit: %v", err)
	}
	if !bytes.Equal(before, checkpointForTest(t, h)) {
		t.Fatal("rejected setup changed exercise, traffic, records or accepted command journal")
	}
}

func TestAircraftAddAccepts20thAndRejects21stAtomically(t *testing.T) {
	h, err := OpenBrowser(nil)
	if err != nil {
		t.Fatal(err)
	}
	_, err = h.Submit(Command{ID: "setup-19", ExerciseID: h.state.ExerciseID, Type: "scenario-setup", Payload: trafficSetupPayload(t, 19)}, "instructor")
	if err != nil {
		t.Fatal(err)
	}
	payload := json.RawMessage(`{"callsign":"220","qteDeg":110,"rangeNm":35,"headingDeg":180,"speedKt":240,"altitudeFt":10000}`)
	_, err = h.Submit(Command{ID: "add-20", ExerciseID: h.state.ExerciseID, Type: "aircraft-add", Payload: payload}, "instructor")
	if err != nil || len(h.state.Aircraft) != 20 {
		t.Fatalf("20th aircraft was not admitted: %v", err)
	}
	before := checkpointForTest(t, h)
	_, err = h.Submit(Command{ID: "add-21", ExerciseID: h.state.ExerciseID, Type: "aircraft-add", Payload: json.RawMessage(`{"callsign":"221"}`)}, "instructor")
	if err == nil || !strings.Contains(err.Error(), "20 aircraft") {
		t.Fatalf("21st aircraft should report the new 20-aircraft limit: %v", err)
	}
	if !bytes.Equal(before, checkpointForTest(t, h)) {
		t.Fatal("rejected addition changed traffic, sequence, revision or command journal")
	}
}

func TestLegacy24AircraftCheckpointStillValidAndRecoverable(t *testing.T) {
	s := preset("area")
	s.ExerciseID = "legacy-24"
	s.Aircraft = make([]Aircraft, 24)
	s.Strips = map[string]Strip{}
	s.Criteria, s.Calls, s.Reports, s.Events = nil, nil, nil, nil
	s.Radio = RadioView{Phase: "idle"}
	for i := range s.Aircraft {
		s.Aircraft[i] = baseAircraft(fmt.Sprintf("legacy%d", i+1), fmt.Sprint(301+i), float64(i), 0, 90, 240, 10000)
		s.Strips[s.Aircraft[i].ID] = Strip{}
	}
	if err := validateState(&s); err != nil {
		t.Fatalf("existing 24-aircraft state was rejected: %v", err)
	}
	raw, err := json.Marshal(browserCheckpoint{State: s})
	if err != nil {
		t.Fatal(err)
	}
	h, err := OpenBrowser(raw)
	if err != nil || len(h.state.Aircraft) != 24 || h.state.Running {
		t.Fatalf("legacy checkpoint must recover all 24 aircraft while paused: %v", err)
	}
	if len(h.View("instructor").(InstructorView).Aircraft) != 24 {
		t.Fatal("legacy instructor review lost aircraft")
	}
	before := checkpointForTest(t, h)
	_, err = h.Submit(Command{ID: "legacy-add", ExerciseID: h.state.ExerciseID, Type: "aircraft-add", Payload: json.RawMessage(`{"callsign":"400"}`)}, "instructor")
	if err == nil || !bytes.Equal(before, checkpointForTest(t, h)) {
		t.Fatal("legacy state admitted new traffic or changed during rejected admission")
	}
}
