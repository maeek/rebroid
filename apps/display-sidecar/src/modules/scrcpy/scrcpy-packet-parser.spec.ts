import assert from "node:assert/strict";
import test from "node:test";
import {
  SCRCPY_CODEC_H264,
  SCRCPY_CODEC_OPUS,
  ScrcpyPacket,
  ScrcpyPacketParser,
} from "./scrcpy-packet-parser";

const packetHeader = ({
  size,
  pts = 42n,
  config = false,
  keyFrame = false,
}: {
  size: number;
  pts?: bigint;
  config?: boolean;
  keyFrame?: boolean;
}) => {
  const header = Buffer.alloc(12);
  let ptsAndFlags = pts;
  if (config) {
    ptsAndFlags |= 1n << 62n;
  }
  if (keyFrame) {
    ptsAndFlags |= 1n << 61n;
  }
  header.writeBigUInt64BE(ptsAndFlags, 0);
  header.writeUInt32BE(size, 8);
  return header;
};

const codecHeader = (codec: number) => {
  const header = Buffer.alloc(4);
  header.writeUInt32BE(codec, 0);
  return header;
};

test("parses codec id, frame metadata, and keyframe flag", () => {
  const packets: ScrcpyPacket[] = [];
  const payload = Buffer.from([1, 2, 3, 4]);
  const parser = new ScrcpyPacketParser({
    expectedCodec: SCRCPY_CODEC_H264,
    allowSessionPackets: true,
    onPacket: (packet) => packets.push(packet),
  });

  parser.push(
    Buffer.concat([
      codecHeader(SCRCPY_CODEC_H264),
      packetHeader({ size: payload.byteLength, config: true, keyFrame: true }),
      payload,
    ]),
  );

  assert.equal(packets.length, 1);
  assert.deepEqual([...packets[0]!.data], [...payload]);
  assert.equal(packets[0]!.timestampUs, 42n);
  assert.equal(packets[0]!.config, true);
  assert.equal(packets[0]!.keyFrame, true);
});

test("parses a packet split across every header and payload boundary", () => {
  const packets: ScrcpyPacket[] = [];
  const payload = Buffer.from([9, 8, 7, 6, 5]);
  const stream = Buffer.concat([
    codecHeader(SCRCPY_CODEC_H264),
    packetHeader({ size: payload.byteLength, pts: 9001n, keyFrame: true }),
    payload,
  ]);
  const parser = new ScrcpyPacketParser({
    expectedCodec: SCRCPY_CODEC_H264,
    allowSessionPackets: true,
    onPacket: (packet) => packets.push(packet),
  });

  for (const byte of stream) {
    parser.push(Buffer.from([byte]));
  }

  assert.equal(packets.length, 1);
  assert.equal(packets[0]!.timestampUs, 9001n);
  assert.equal(packets[0]!.keyFrame, true);
  assert.deepEqual([...packets[0]!.data], [...payload]);
});

test("parses and skips video session packets", () => {
  const sessions: Array<{
    width: number;
    height: number;
    clientResized: boolean;
  }> = [];
  const packets: ScrcpyPacket[] = [];
  const session = Buffer.alloc(12);
  session[0] = 0x80;
  session[3] = 1;
  session.writeUInt32BE(1080, 4);
  session.writeUInt32BE(1920, 8);
  const payload = Buffer.from([5]);
  const parser = new ScrcpyPacketParser({
    expectedCodec: SCRCPY_CODEC_H264,
    allowSessionPackets: true,
    onSessionPacket: (packet) => sessions.push(packet),
    onPacket: (packet) => packets.push(packet),
  });

  parser.push(
    Buffer.concat([
      codecHeader(SCRCPY_CODEC_H264),
      session,
      packetHeader({ size: payload.byteLength }),
      payload,
    ]),
  );

  assert.deepEqual(sessions, [
    { width: 1080, height: 1920, clientResized: true },
  ]);
  assert.equal(packets.length, 1);
  assert.deepEqual([...packets[0]!.data], [...payload]);
});

test("rejects session packets on audio streams", () => {
  const parser = new ScrcpyPacketParser({
    expectedCodec: SCRCPY_CODEC_OPUS,
    allowSessionPackets: false,
    onPacket: () => undefined,
  });
  const session = Buffer.alloc(12);
  session[0] = 0x80;

  assert.throws(
    () => parser.push(Buffer.concat([codecHeader(SCRCPY_CODEC_OPUS), session])),
    /Unexpected scrcpy session packet/,
  );
});

test("rejects invalid packet lengths", () => {
  const parser = new ScrcpyPacketParser({
    expectedCodec: SCRCPY_CODEC_H264,
    allowSessionPackets: true,
    onPacket: () => undefined,
  });

  assert.throws(
    () =>
      parser.push(
        Buffer.concat([
          codecHeader(SCRCPY_CODEC_H264),
          packetHeader({ size: 0 }),
        ]),
      ),
    /Invalid scrcpy packet length/,
  );
});

test("reports disabled and configuration-failure stream markers", () => {
  let disabled = false;
  const disabledParser = new ScrcpyPacketParser({
    expectedCodec: SCRCPY_CODEC_OPUS,
    allowSessionPackets: false,
    onDisabled: () => {
      disabled = true;
    },
    onPacket: () => undefined,
  });
  disabledParser.push(codecHeader(0));
  assert.equal(disabled, true);

  const failedParser = new ScrcpyPacketParser({
    expectedCodec: SCRCPY_CODEC_OPUS,
    allowSessionPackets: false,
    onPacket: () => undefined,
  });
  assert.throws(
    () => failedParser.push(codecHeader(1)),
    /scrcpy stream configuration failed/,
  );
});
