import assert from "node:assert/strict";
import test from "node:test";
import { SidecarFeatureService } from "./sidecar-feature.service";
import type { SidecarConfigService } from "./sidecar-config.service";

test("an empty external TCP policy supersedes deployment endpoints and stale refreshes", () => {
  const endpoint = "192.168.1.20:5555";
  const service = new SidecarFeatureService({
    externalAdbEnabled: true,
    externalAdbTcpEndpoints: new Set([endpoint]),
  } as SidecarConfigService);
  const snapshot = {
    revision: 1,
    features: [
      { key: "feature.display-virtual", effective: false },
      { key: "feature.display-webrtc", effective: false },
      { key: "feature.external-devices", effective: true },
    ],
  } satisfies Parameters<SidecarFeatureService["apply"]>[0];
  service.apply(snapshot);
  assert.equal(service.isExternalTcpApproved(endpoint), true);
  service.apply({
    ...snapshot,
    tcpPolicy: { revision: 1, endpoints: ["192.168.1.0/24"] },
  });
  assert.equal(service.isExternalTcpApproved("192.168.1.21:6666"), true);
  assert.equal(service.isExternalTcpApproved("192.168.2.21:6666"), false);
  service.apply({ ...snapshot, tcpPolicy: { revision: 2, endpoints: [] } });
  service.apply({
    ...snapshot,
    tcpPolicy: { revision: 1, endpoints: [endpoint] },
  });
  service.apply(snapshot);
  assert.equal(service.isExternalTcpApproved(endpoint), false);
  assert.equal(service.isExternalTcpApproved("192.168.1.21:6666"), false);
});

test("external broker requires its own effective flag in the feature snapshot", () => {
  const service = new SidecarFeatureService({
    externalAdbEnabled: true,
  } as SidecarConfigService);
  const features = [
    { key: "feature.display-virtual", effective: false },
    { key: "feature.display-webrtc", effective: true },
  ] as const;
  assert.equal(service.isExternalAdbEnabled(), false);
  assert.throws(() => service.apply({ revision: 1, features: [...features] }));
  service.apply({
    revision: 2,
    features: [
      ...features,
      { key: "feature.external-devices", effective: true },
    ],
  });
  assert.equal(service.isExternalAdbEnabled(), true);
  service.apply({
    revision: 3,
    features: [
      ...features,
      { key: "feature.external-devices", effective: false },
    ],
  });
  assert.equal(service.isExternalAdbEnabled(), false);
  assert.equal(service.isWebrtcEnabled(), true);
});

test("feature snapshots replace display state atomically", () => {
  const service = new SidecarFeatureService();
  service.apply({
    revision: 2,
    features: [
      { key: "feature.display-virtual", effective: true },
      { key: "feature.display-webrtc", effective: false },
    ],
  });

  assert.deepEqual(service.state(), {
    revision: 2,
    features: [
      { key: "feature.display-virtual", effective: true },
      { key: "feature.display-webrtc", effective: false },
    ],
  });
  assert.doesNotThrow(() => service.assertVirtualDisplayEnabled());
  assert.throws(() => service.assertWebrtcEnabled());
});

test("feature snapshots reject stale revisions and invalid ownership", () => {
  const service = new SidecarFeatureService();
  service.apply({
    revision: 2,
    features: [
      { key: "feature.display-virtual", effective: false },
      { key: "feature.display-webrtc", effective: true },
    ],
  });

  assert.throws(() =>
    service.apply({
      revision: 1,
      features: [
        { key: "feature.display-virtual", effective: true },
        { key: "feature.display-webrtc", effective: false },
      ],
    }),
  );
  assert.throws(() =>
    service.apply({
      revision: 3,
      features: [{ key: "feature.ocr", effective: true } as never],
    }),
  );
});
