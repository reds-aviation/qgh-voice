/*
The contents of this file are subject to the Common Public Attribution License Version 1.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at https://opensource.org/license/cpal_1-0. The License is based on the Mozilla Public License Version 1.1 but Sections 14 and 15 have been added to cover use of software over a computer network and provide for limited attribution for the Original Developer. In addition, Exhibit A has been modified to be consistent with Exhibit B.
Software distributed under the License is distributed on an "AS IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License for the specific language governing rights and limitations under the License.
The Original Code is ATS SIM BOX.
The Original Developer is the Initial Developer.
The Initial Developer of the Original Code is Balaram Reddy. All portions of the code written by Balaram Reddy are Copyright (c) 2026 Balaram Reddy. All Rights Reserved.
Contributor(s): None designated in this initial notice.
No alternative licence is designated for this CPAL version. Historical MIT releases retain the permissions described in COPYRIGHT.md.
*/

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
