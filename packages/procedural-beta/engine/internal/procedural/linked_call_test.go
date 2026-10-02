package procedural

import (
	"encoding/json"
	"testing"
)

func TestLinkedCallClearanceAtomicAndIdempotent(t *testing.T) {
	h, err := OpenBrowser(nil)
	if err != nil {
		t.Fatal(err)
	}
	a := &h.state.Aircraft[0]
	h.state.Calls = []Call{{ID: "call-test", AircraftID: a.ID, Text: "Request heading", Status: "pending"}}
	send := func(id, payload string) error {
		_, e := h.Submit(Command{ID: id, ExerciseID: h.state.ExerciseID, Type: "clearance", AircraftID: a.ID, Payload: json.RawMessage(payload)}, "instructor")
		return e
	}
	before := h.state.Revision
	if send("invalid-linked", `{"action":"speed","value":9999,"callId":"call-test"}`) == nil {
		t.Fatal("invalid instruction accepted")
	}
	if h.state.Calls[0].Status != "pending" || h.state.Revision != before {
		t.Fatal("failed instruction acknowledged call or changed exercise")
	}
	payload := `{"action":"heading","direction":"right","value":180,"callId":"call-test"}`
	if err = send("valid-linked", payload); err != nil {
		t.Fatal(err)
	}
	if h.state.Calls[0].Status != "handled" {
		t.Fatal("accepted instruction did not acknowledge linked call")
	}
	count := len(h.state.Reports)
	revision := h.state.Revision
	if err = send("valid-linked", payload); err != nil {
		t.Fatal(err)
	}
	if len(h.state.Reports) != count || h.state.Revision != revision {
		t.Fatal("retried instruction created duplicate readback or revision")
	}
	if send("stale-linked", payload) == nil {
		t.Fatal("already handled call accepted in a new instruction")
	}
}
