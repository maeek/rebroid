import assert from "node:assert/strict";
import test from "node:test";
import { FragmentedMp4Muxer } from "../dist/modules/display/viewer/assets/fragmented-mp4.js";
import { codecConfiguration } from "../dist/modules/display/viewer/assets/h264.js";

const annexB = (...nals) =>
  Uint8Array.from(nals.flatMap((nal) => [0, 0, 0, 1, ...nal]));
const nativePortraitConfiguration = annexB(
  [
    0x67, 0x42, 0xc0, 0x33, 0xd9, 0x00, 0x44, 0x01, 0x27, 0xe5, 0x9f, 0x01,
    0x10, 0x00, 0x00, 0x03, 0x00, 0x10, 0x00, 0x00, 0x07, 0x80, 0xf1, 0x83,
    0x24, 0x80,
  ],
  [0x68, 0xcb, 0x83, 0xcb, 0x20],
);

const boxTypes = (buffer) => {
  const types = [];
  const bytes = new Uint8Array(buffer);
  for (let index = 0; index + 8 <= bytes.byteLength;) {
    const view = new DataView(bytes.buffer, bytes.byteOffset + index);
    const size = view.getUint32(0);
    if (size < 8 || index + size > bytes.byteLength) break;
    types.push(String.fromCharCode(...bytes.subarray(index + 4, index + 8)));
    index += size;
  }
  return types;
};

test("fragmented MP4 keeps source PTS and emits bounded AVC fragments", () => {
  const muxer = new FragmentedMp4Muxer();
  const initialization = muxer.initialize({
    codec: "avc1.42E01F",
    sps: Uint8Array.from([0x67, 0x42, 0xe0, 0x1f]),
    pps: Uint8Array.from([0x68, 0xce, 0x06, 0xe2]),
    width: 1080,
    height: 2340,
  });
  assert.deepEqual(boxTypes(initialization.segment), ["ftyp", "moov"]);

  const fragment = muxer.fragment(
    [
      {
        sequence: 7,
        timestampUs: 1_000_000,
        keyFrame: true,
        data: annexB([0x65, 0x88, 0x84]),
      },
      {
        sequence: 8,
        timestampUs: 1_016_667,
        keyFrame: false,
        data: annexB([0x41, 0x9a, 0x20]),
      },
    ],
    1_033_334,
  );

  assert.deepEqual(boxTypes(fragment.segment), ["moof", "mdat"]);
  assert.equal(fragment.sourcePtsOriginUs, 1_000_000);
  assert.equal(fragment.samples.at(-1).sequence, 8);
  assert.ok(fragment.durationMs >= 33 && fragment.durationMs < 34);
});

test("H.264 SPS exposes the native portrait dimensions and level", () => {
  const configuration = codecConfiguration(nativePortraitConfiguration);
  assert.equal(configuration.profileLevelId, "42c033");
  assert.equal(configuration.width, 1080);
  assert.equal(configuration.height, 2340);
});

test("fragmented MP4 rejects reordered source PTS", () => {
  const muxer = new FragmentedMp4Muxer();
  muxer.initialize({
    codec: "avc1.42E01F",
    sps: Uint8Array.from([0x67, 0x42, 0xe0, 0x1f]),
    pps: Uint8Array.from([0x68, 0xce, 0x06, 0xe2]),
    width: 1080,
    height: 2340,
  });
  assert.throws(
    () =>
      muxer.fragment([
        {
          sequence: 1,
          timestampUs: 20,
          keyFrame: true,
          data: annexB([0x65]),
        },
        {
          sequence: 2,
          timestampUs: 10,
          keyFrame: false,
          data: annexB([0x41]),
        },
      ]),
    /PTS must advance/,
  );
});
