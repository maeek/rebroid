import assert from "node:assert/strict";
import test from "node:test";
import { SidecarFeatureService } from "./sidecar-feature.service";
import type { SidecarConfigService } from "./sidecar-config.service";

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
