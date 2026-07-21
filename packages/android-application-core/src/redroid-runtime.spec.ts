import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  applyRedroidDefaultContainerArgs,
  applyRedroidDisplayContainerArgs,
  getRedroidDisplayDimensionsFromArgs,
  isRedroidImageName,
  redroidDefaultContainerArgs,
  resolveRuntimeImageMetadata,
  runtimeImageLabelKeys,
} from "./redroid-runtime";

describe("redroid runtime", () => {
  it("detects redroid images", () => {
    assert.equal(isRedroidImageName("redroid"), true);
    assert.equal(isRedroidImageName("redroid/redroid:14.0.0-latest"), true);
    assert.equal(isRedroidImageName("example/redroid:latest"), true);
    assert.equal(isRedroidImageName("ghcr.io/example/android"), false);
  });

  it("applies only redroid defaults for redroid images", () => {
    assert.equal(
      applyRedroidDefaultContainerArgs("redroid/redroid:14.0.0-latest"),
      redroidDefaultContainerArgs.join(" "),
    );
  });

  it("applies redroid defaults for custom images with explicit runtime kind", () => {
    assert.equal(
      applyRedroidDefaultContainerArgs("local/microg:14", "", "redroid"),
      redroidDefaultContainerArgs.join(" "),
    );
  });

  it("keeps user-provided overrides", () => {
    const value = applyRedroidDefaultContainerArgs(
      "redroid/redroid:14.0.0-latest",
      'ro.secure=1 androidboot.redroid_width=1080 "androidboot.use_memfd=false"',
    );
    const args = (value ?? "").split(/\s+/);
    assert.deepEqual(
      args.filter((arg) => arg === "ro.secure=1"),
      ["ro.secure=1"],
    );
    assert.deepEqual(
      args.filter((arg) => arg === "androidboot.redroid_width=1080"),
      ["androidboot.redroid_width=1080"],
    );
    assert.deepEqual(
      args.filter((value) => value.startsWith("androidboot.use_memfd=")),
      ["androidboot.use_memfd=false"],
    );
  });

  it("applies display defaults when missing", () => {
    const value = applyRedroidDisplayContainerArgs(
      "redroid/redroid:14.0.0-latest",
      "phone-21-9",
      "",
      undefined,
    );
    assert.ok(value?.includes("androidboot.redroid_width=1080"));
    assert.ok(value?.includes("androidboot.redroid_height=2520"));
  });

  it("resolves runtime metadata from stored data before labels and names", () => {
    const resolved = resolveRuntimeImageMetadata({
      image: "redroid/redroid:14",
      labels: {
        [runtimeImageLabelKeys.runtimeKind]: "redroid",
        [runtimeImageLabelKeys.androidVersion]: "14",
      },
      metadata: {
        runtimeKind: "generic",
        androidVersion: null,
        architecture: null,
        gmsMode: "none",
        signatureSpoofing: "not_applicable",
      },
    });

    assert.equal(resolved.source, "stored");
    assert.equal(resolved.metadata.runtimeKind, "generic");
  });

  it("resolves custom redroid metadata from labels", () => {
    const resolved = resolveRuntimeImageMetadata({
      image: "local/microg:14",
      labels: {
        [runtimeImageLabelKeys.runtimeKind]: "redroid",
        [runtimeImageLabelKeys.androidVersion]: "14",
        [runtimeImageLabelKeys.architecture]: "amd64",
        [runtimeImageLabelKeys.gmsMode]: "microg",
        [runtimeImageLabelKeys.signatureSpoofing]: "present_unverified",
      },
    });

    assert.equal(resolved.source, "labels");
    assert.deepEqual(resolved.metadata, {
      runtimeKind: "redroid",
      androidVersion: "14",
      architecture: "amd64",
      gmsMode: "microg",
      signatureSpoofing: "present_unverified",
    });
  });

  it("resolves Google Play images without signature spoofing", () => {
    const resolved = resolveRuntimeImageMetadata({
      image: "local/redroid-gapps:14",
      labels: {
        [runtimeImageLabelKeys.runtimeKind]: "redroid",
        [runtimeImageLabelKeys.androidVersion]: "14",
        [runtimeImageLabelKeys.architecture]: "amd64",
        [runtimeImageLabelKeys.gmsMode]: "gapps",
        [runtimeImageLabelKeys.signatureSpoofing]: "not_applicable",
      },
    });

    assert.equal(resolved.metadata.gmsMode, "gapps");
    assert.equal(resolved.metadata.signatureSpoofing, "not_applicable");
  });

  it("parses redroid display dimensions", () => {
    assert.deepEqual(
      getRedroidDisplayDimensionsFromArgs(
        "androidboot.redroid_width=900 androidboot.redroid_height=1800",
      ),
      { width: 900, height: 1800, aspectRatio: 0.5 },
    );
  });

  it("preserves user args and applies explicit display overrides first", () => {
    const value = applyRedroidDisplayContainerArgs(
      "redroid/redroid:14.0.0-latest",
      "phone-21-9",
      'androidboot.redroid_width=640 "androidboot.redroid_height=360"',
      { width: 800, height: 600, dpi: 480, fps: 90 },
    );
    assert.ok(
      value?.includes("androidboot.redroid_width=640"),
      "user width should win",
    );
    assert.ok(
      value?.includes("androidboot.redroid_height=360"),
      "user height should win",
    );
    assert.ok(
      value?.includes("androidboot.redroid_dpi=480"),
      "default from display config should apply",
    );
    assert.ok(value?.includes("androidboot.redroid_fps=90"));
  });
});
