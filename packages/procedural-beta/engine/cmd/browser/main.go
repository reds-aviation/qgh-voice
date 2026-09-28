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
