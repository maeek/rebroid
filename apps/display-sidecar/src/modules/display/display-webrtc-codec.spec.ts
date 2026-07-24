import assert from "node:assert/strict";
import test from "node:test";
import { findCompatibleH264Offer } from "./display-webrtc-codec";

const offer = (...fmtp: string[]) =>
  [
    "m=video 9 UDP/TLS/RTP/SAVPF 96 97 98",
    "a=rtpmap:96 H264/90000",
    `a=fmtp:96 ${fmtp[0]}`,
    "a=rtpmap:97 H264/90000",
    `a=fmtp:97 ${fmtp[1]}`,
    "a=rtpmap:98 VP8/90000",
  ].join("\r\n");

test("matches compatible constrained-baseline packetization mode 1", () => {
  const match = findCompatibleH264Offer(
    offer(
      "level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f",
      "level-asymmetry-allowed=1;packetization-mode=0;profile-level-id=42e01f",
    ),
    "42c033",
  );

  assert.deepEqual(match, {
    payloadType: "96",
    profileLevelId: "42e01f",
  });
});

test("rejects incompatible profiles and insufficient symmetric levels", () => {
  assert.equal(
    findCompatibleH264Offer(
      offer(
        "level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=4d0033",
        "level-asymmetry-allowed=1;packetization-mode=0;profile-level-id=42e033",
      ),
      "42c033",
    ),
    null,
  );
  assert.equal(
    findCompatibleH264Offer(
      offer(
        "level-asymmetry-allowed=0;packetization-mode=1;profile-level-id=42e01f",
        "level-asymmetry-allowed=0;packetization-mode=0;profile-level-id=42e033",
      ),
      "42c033",
    ),
    null,
  );
});
