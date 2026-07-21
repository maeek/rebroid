# Scrcpy Invariants

`apps/display-sidecar/src/modules/scrcpy/scrcpy.service.ts` is intentionally not split yet. Its ordering is fragile and must remain behaviorally frozen until the Redroid integration harness can automate the lifecycle.

## Change Rules

- Do not reorder awaited ADB commands, socket reads, listener registration, or cleanup calls.
- Do not merge process launch, socket acquisition, retry, or shutdown steps for stylistic reasons.
- Add diagnostics without changing timing or control flow.
- Extract one responsibility at a time only after manual Redroid verification.
- Verify launch, video, control input, disconnect, retry, and shutdown for every extraction.
- Recording hooks were removed and stable/tunnel/control configuration was injected without reordering the startup, socket, retry, or cleanup sequence. Treat those touched lifecycle regions as requiring the full manual matrix before merge.

## Future Harness

The future harness should provision a real Redroid container, wait for Android boot, start a sidecar viewer session, assert media bytes, send one control action, force a disconnect, assert retry or cleanup, and stop the session cleanly.
