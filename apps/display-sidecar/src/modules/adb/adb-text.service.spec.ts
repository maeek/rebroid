import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import { AdbTextService } from "./adb-text.service";
import type { AdbService } from "./adb.service";

const target = "android:5555";
const label = "Żappka & bonus";
const xml = `<hierarchy>
  <node text="Żappka &amp; bonus" bounds="[1,1][9,9]" visible-to-user="false" />
  <node text="Żappka &amp; bonus" bounds="[1,1][9,9]" enabled="false" />
  <node text="Żappka &amp; bonus" bounds="[5,5][5,5]" />
  <node resource-id="Żappka &amp; bonus" bounds="[1,1][9,9]" />
  <node text="Open Żappka &amp; bonus" bounds="[1,1][9,9]" />
  <node bounds="[100,200][140,260]" content-desc="Z&#x307;appka &amp; bonus" />
</hierarchy>`;
const input = {
  text: label,
  match: "exact",
  operation: "wait",
  timeoutMs: 500,
  intervalMs: 250,
} as const;

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

test("single-pixel bounds yield a tap inside the label", async () => {
  const adb = {
    dumpUi: async () => ({
      status: "available",
      xml: '<hierarchy><node text="Żappka" bounds="[7,8][8,9]"/></hierarchy>',
    }),
  } as unknown as AdbService;
  const service = new AdbTextService(adb);
  assert.deepEqual(
    await service.poll(
      target,
      { ...input, text: "Żappka" },
      new AbortController().signal,
    ),
    { status: "found", x: 7, y: 8 },
  );
});

test("wait and tap share the same Unicode, XML, visibility, and bounds rules", async () => {
  const taps: number[][] = [];
  const adb = {
    dumpUi: async () => ({ status: "available", xml }),
    tap: async (_udid: string, x: number, y: number) => {
      taps.push([x, y]);
    },
  } as unknown as AdbService;
  const service = new AdbTextService(adb);
  const signal = new AbortController().signal;

  assert.deepEqual(await service.poll(target, input, signal), {
    status: "found",
    x: 120,
    y: 230,
  });
  assert.deepEqual(taps, []);
  assert.deepEqual(
    await service.poll(target, { ...input, operation: "tap" }, signal),
    {
      status: "found",
      x: 120,
      y: 230,
    },
  );
  assert.deepEqual(taps, [[120, 230]]);
  assert.deepEqual(
    await service.poll(target, { ...input, match: "contains" }, signal),
    {
      status: "found",
      x: 5,
      y: 5,
    },
  );
});

test("polling respects the remaining budget and distinguishes missing text from an unavailable hierarchy", async () => {
  let attempts = 0;
  const adb = {
    dumpUi: async () => {
      attempts++;
      return { status: "available", xml: "<hierarchy></hierarchy>" };
    },
  } as unknown as AdbService;
  const service = new AdbTextService(adb);
  const signal = new AbortController().signal;
  const start = performance.now();
  assert.deepEqual(
    await service.poll(target, { ...input, timeoutMs: 40 }, signal),
    {
      status: "not_found",
    },
  );
  assert.equal(attempts, 1);
  assert.ok(performance.now() - start < 250);

  adb.dumpUi = async () => ({
    status: "failed",
    error: "Unavailable",
    attempts: [],
  });
  assert.deepEqual(
    await service.poll(target, { ...input, timeoutMs: 40 }, signal),
    {
      status: "hierarchy_unavailable",
    },
  );
});

test("a deadline aborts the ADB dump and cannot admit a late tap", async () => {
  let dumpSignal: AbortSignal | undefined;
  let taps = 0;
  const adb = {
    dumpUi: async (_udid: string, signal: AbortSignal) => {
      dumpSignal = signal;
      await delay(1_000, undefined, { signal }).catch(() => undefined);
      return { status: "available", xml };
    },
    tap: async () => {
      taps++;
    },
  } as unknown as AdbService;
  const service = new AdbTextService(adb);
  const result = await service.poll(
    target,
    { ...input, operation: "tap", timeoutMs: 40 },
    new AbortController().signal,
  );
  assert.deepEqual(result, { status: "not_found" });
  assert.equal(dumpSignal?.aborted, true);
  assert.equal(taps, 0);
});

test("an uncertain tap is not dispatched again", async () => {
  let taps = 0;
  const adb = {
    dumpUi: async () => ({ status: "available", xml }),
    tap: async (_udid: string, _x: number, _y: number, signal: AbortSignal) => {
      taps++;
      await delay(1000, undefined, { signal });
    },
  } as unknown as AdbService;
  const service = new AdbTextService(adb);
  const result = await service.poll(
    target,
    { ...input, operation: "tap", timeoutMs: 40 },
    new AbortController().signal,
  );
  assert.deepEqual(result, { status: "tap_outcome_unknown" });
  assert.equal(taps, 1);
});

test("an early cancellation prevents a matching tap request from polling", async () => {
  let dumps = 0;
  const service = new AdbTextService({
    dumpUi: async () => {
      dumps++;
      return { status: "available", xml };
    },
  } as unknown as AdbService);
  const operationId = "operation";
  service.cancel(target, operationId);
  await assert.rejects(
    service.poll(
      target,
      { ...input, operation: "tap", operationId },
      new AbortController().signal,
    ),
    /UI text operation was canceled/,
  );
  assert.equal(dumps, 0);
});

test("a canceled tap acknowledges cancellation only after the dispatched action settles", async () => {
  const started = deferred<AbortSignal>();
  const release = deferred<void>();
  const service = new AdbTextService({
    dumpUi: async () => ({ status: "available", xml }),
    tap: async (_udid: string, _x: number, _y: number, signal: AbortSignal) => {
      started.resolve(signal);
      await release.promise;
    },
  } as unknown as AdbService);
  const operationId = "operation";
  let settled = false;
  const pending = service.poll(
    target,
    { ...input, operation: "tap", operationId },
    new AbortController().signal,
  );
  const canceled = assert
    .rejects(pending, /UI text operation was canceled/)
    .then(() => {
      settled = true;
    });
  const signal = await started.promise;
  service.cancel(target, operationId);
  try {
    await delay(0);
    assert.equal(signal.aborted, true);
    assert.equal(settled, false);
  } finally {
    release.resolve();
    await canceled;
  }
});
