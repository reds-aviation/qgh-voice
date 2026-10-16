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
	"crypto/rand"
	"encoding/json"
	"errors"
	"time"
)

type browserReceipt struct {
	Fingerprint string  `json:"fingerprint"`
	Receipt     Receipt `json:"receipt"`
}
type browserRegistry struct {
	Receipts map[string]browserReceipt `json:"receipts"`
}
type browserCheckpoint struct {
	State    State                     `json:"state"`
	Receipts map[string]browserReceipt `json:"receipts"`
}

// The SharedWorker owns this host. Its IndexedDB transaction must commit the
// checkpoint before returning a successful command response to any tab.
func OpenBrowser(raw []byte) (*Host, error) {
	h := &Host{now: time.Now, browser: &browserRegistry{Receipts: map[string]browserReceipt{}}}
	h.lastWall = h.now()
	if len(raw) == 0 || string(raw) == "null" {
		h.state = preset("area")
		h.state.ExerciseID = "exercise-" + rand.Text()
	} else {
		var saved browserCheckpoint
		if err := decode(raw, &saved); err != nil {
			return nil, err
		}
		if err := validateState(&saved.State); err != nil {
			return nil, err
		}
		if len(saved.Receipts) > 50000 {
			return nil, errors.New("browser command journal exceeds capacity")
		}
		for id, r := range saved.Receipts {
			if !validID(id) || len(r.Fingerprint) != 64 || r.Receipt.ID != id || !r.Receipt.Accepted {
				return nil, errors.New("invalid browser command journal")
			}
		}
		h.state = saved.State
		if saved.Receipts != nil {
			h.browser.Receipts = saved.Receipts
		}
		h.state.Running = false
		h.state.Radio = RadioView{Phase: "idle"}
		record(&h.state, "recovered-paused", "Browser exercise recovered paused; radio cleared", "")
		h.state.Revision++
	}
	return h, nil
}
func (h *Host) BrowserCheckpoint() ([]byte, error) {
	h.mu.Lock()
	defer h.mu.Unlock()
	return json.Marshal(browserCheckpoint{State: h.state, Receipts: h.browser.Receipts})
}
func (h *Host) BrowserTick(ownerPresent bool) {
	h.mu.Lock()
	defer h.mu.Unlock()
	now := h.now()
	// Sleeping/throttled computers must not silently fly a long catch-up interval.
	if h.state.Running && (!ownerPresent || now.Sub(h.lastWall) > 3*time.Second) {
		h.state.Running = false
		h.radio = nil
		h.state.Radio = RadioView{Phase: "idle"}
		record(&h.state, "browser-paused", "Instructor disconnected or browser suspended; exercise paused", "")
		h.state.Revision++
		h.lastWall = now
	}
	h.syncLocked(now)
}
