import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  applyRedroidDefaultContainerArgs,
  applyRedroidDisplayContainerArgs,
  getRedroidDisplayDimensionsFromArgs,
  isRedroidImageName,
  redroidDefaultContainerArgs,
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
