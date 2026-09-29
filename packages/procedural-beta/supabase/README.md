# Procedural online rooms

The website stays on GitHub Pages. The instructor's existing Go/WASM worker owns the aircraft and clock. Supabase stores room membership, the student projection, command receipts and the current uploaded map. This is a managed relay, not a server-hosted flight engine: the instructor tab must remain open.

## Setup

1. Create a Free Supabase project. The current project is in Mumbai (`ap-south-1`).
2. Run `001_sessions.sql` once in that project's SQL editor.
3. Enable anonymous sign-ins in Authentication → Sign In / Providers. Every tab gets a separate Auth identity; no trainee email or password is required.
4. Place only the project URL and `sb_publishable_…` key in `static/remote-config.js`. Secret and service-role keys must never enter the website, repository, logs or screenshots.
5. Run the local SQL/engine tests and the live integration check before enabling the published option. Refresh the procedural asset manifest and build the GitHub Pages package.

## Flow and isolation

- Instructor selects Online room, prepares the roster and shares the six-digit PIN. Each new instructor setup has a separate worker, checkpoint, server room and PIN.
- A controller selects Online room on another device, enters their name/PIN, waits for Admit, then presses Ready. PIN possession creates only a waiting membership; it exposes no exercise data.
- Only the owner can admit, remove, publish, reset the PIN or share a map. Controllers can send typed calls and strip updates after Ready. The engine validates them again as student commands; a controller cannot fly aircraft or read instructor truth.
- The browser publishes the engine's student view, never its instructor view. The server rejects instructor-role payloads and top-level aircraft/events/alerts. Private tables have RLS enabled, no direct client privileges, and a narrow authenticated function checks every operation.
- Tabs store Auth tokens in session storage under separate random client IDs. A host lease prevents a replaced connection from continuing to publish. Requests are identified and acknowledged after the worker has saved them, so retries do not repeat an instruction.
- Closed or removed students lose snapshot/map access on their next request. New exercises rotate the PIN and close old admissions. Room data expires after eight hours and is purged by subsequent room creation.

## Timing and capacity

The relay exchanges a bounded snapshot approximately once per second over HTTPS. Student-to-instructor instructions may take about two seconds plus network time. The local scope sweep runs independently at its configured RPM; this relay does not send animation frames or hidden target positions. Six seconds without a cloud heartbeat pauses the instructor engine; student displays freeze and clear stale radio/bearing information. Reconnection does not automatically restart traffic.

The initial pilot caps retained active rooms at 40 and controllers at 24 per room. These are admission limits, **not a measured concurrency or availability guarantee**. They protect the free project while usage is established. There is no separate load balancer to deploy: Supabase handles API requests, and each instructor device handles its own simulation. Monitor database size, egress, API latency and Auth limits before increasing capacity. Each room stores at most one map of 5 MB and one student snapshot of 512 KiB.

Supabase's anonymous Auth sign-up rate limits still apply (including shared-campus IPs); use established sessions and evaluate usage before changing limits. The Free service can pause after inactivity and has resource quotas. Anonymous Auth users are not automatically cleaned up by the room expiry job; review those accounts during maintenance. A larger public deployment should add a managed abuse-control flow and measured load tests before raising admission limits.

No original uploaded reference photographs are included in this package. A map deliberately uploaded inside an Online room is sent to that private room for admitted controllers; the setup screen states this before the exercise starts.

## Guides and maintenance

`static/guide-knowledge.js` is shared by Gyani and the generated current-flow sections in all four guides. The build verifies its release revision and control IDs. Update an explanation in this source when behaviour changes; builds regenerate all affected sections. They cannot infer a new procedure from arbitrary code changes. The original detailed guides still need editorial updates when those sections change.

References: [Supabase Auth](https://supabase.com/docs/guides/auth/auth-anonymous), [row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security), [Free plan quotas](https://supabase.com/docs/guides/platform/billing-on-supabase).
