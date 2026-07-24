# Scrcpy Invariants

`apps/display-sidecar/src/modules/scrcpy/scrcpy.service.ts` is intentionally not split yet. Its ordering is fragile and must remain behaviorally frozen until the Redroid integration harness can automate the lifecycle.

## Change Rules

- Do not reorder awaited ADB commands, socket reads, listener registration, or cleanup calls.
- Do not merge process launch, socket acquisition, retry, or shutdown steps for stylistic reasons.
- Add diagnostics without changing timing or control flow.
- Extract one responsibility at a time only after manual Redroid verification.
- Verify launch, video, control input, disconnect, retry, and shutdown for every extraction.
- `RBD1` media sinks, segmented packet parsing, and compatibility options were
  introduced without reordering startup, socket, retry, or cleanup. Treat those
  touched lifecycle regions as requiring the full manual matrix before merge.
- A consumer may fall behind without pausing the scrcpy video or audio socket.
  Drop a queued GOP, wait for the next IDR, and replay cached configuration;
  never discard an arbitrary delta frame and continue the same GOP.
- Preserve scrcpy PTS through every media sink. Do not replace it with a
  configured-FPS clock.
- Transport consumers attach above the protected video → audio → control
  socket sequence. WebSocket, peer, bridge, or decoder closure detaches only
  its source attachment; it must not destroy the scrcpy process, ADB transport,
  or source sockets.
- scrcpy v4 reset-video message `17` may be sent over the existing control
  socket for consumer attachment, decoder recovery, or PLI. Coalesce requests
  to at most once per second and require configuration plus IDR before an
  explicit reset is considered successful.

## Future Harness

The future harness should provision a real Redroid container, wait for Android boot, start a sidecar viewer session, assert media bytes, send one control action, force a disconnect, assert retry or cleanup, and stop the session cleanly.
