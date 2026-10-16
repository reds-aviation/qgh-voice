/*
The contents of this file are subject to the Common Public Attribution License Version 1.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at https://opensource.org/license/cpal_1-0. The License is based on the Mozilla Public License Version 1.1 but Sections 14 and 15 have been added to cover use of software over a computer network and provide for limited attribution for the Original Developer. In addition, Exhibit A has been modified to be consistent with Exhibit B.
Software distributed under the License is distributed on an "AS IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License for the specific language governing rights and limitations under the License.
The Original Code is ATS SIM BOX.
The Original Developer is the Initial Developer.
The Initial Developer of the Original Code is Balaram Reddy. All portions of the code written by Balaram Reddy are Copyright (c) 2026 Balaram Reddy. All Rights Reserved.
Contributor(s): None designated in this initial notice.
No alternative licence is designated for this CPAL version. Historical MIT releases retain the permissions described in COPYRIGHT.md.
*/

//go:build js && wasm

package main

import (
	"encoding/json"
	"fmt"
	"reds.local/procedural-g0/internal/procedural"
	"syscall/js"
)

var host *procedural.Host

func call(_ js.Value, args []js.Value) (result any) {
	defer func() {
		if r := recover(); r != nil {
			b, _ := json.Marshal(map[string]any{"error": fmt.Sprint(r)})
			result = string(b)
		}
	}()
	op, raw, role := args[0].String(), args[1].String(), args[2].String()
	var value any
	var err error
	switch op {
	case "init":
		host, err = procedural.OpenBrowser([]byte(raw))
		value = true
	case "tick":
		host.BrowserTick(raw == "true")
		value = true
	case "state":
		value = host.View(role)
	case "export":
		value = host.Export()
	case "checkpoint":
		var b []byte
		b, err = host.BrowserCheckpoint()
		value = json.RawMessage(b)
	case "command":
		var c procedural.Command
		err = json.Unmarshal([]byte(raw), &c)
		if err == nil {
			value, err = host.Submit(c, role)
		}
	default:
		err = fmt.Errorf("unknown browser engine operation")
	}
	if err != nil {
		b, _ := json.Marshal(map[string]any{"error": err.Error()})
		return string(b)
	}
	b, e := json.Marshal(map[string]any{"value": value})
	if e != nil {
		return `{"error":"cannot encode engine response"}`
	}
	return string(b)
}
func main() { js.Global().Set("proceduralEngine", js.FuncOf(call)); select {} }
