import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { resolveContainerImage } from "./container-image";

describe("resolveContainerImage", () => {
  it("leaves images with explicit registry untouched", () => {
    assert.equal(
      resolveContainerImage("localhost:5000/app:1", "registry.internal"),
      "localhost:5000/app:1",
    );
    assert.equal(
      resolveContainerImage("example.com/org/app", "registry.internal"),
      "example.com/org/app",
    );
  });

  it("prepends registry for relative images", () => {
    assert.equal(
      resolveContainerImage("redroid/redroid:14", "registry.internal"),
      "registry.internal/redroid/redroid:14",
    );
  });

  it("normalizes registry prefixes and leaves names untouched when no registry configured", () => {
    assert.equal(resolveContainerImage(" app-image:1 ", null), "app-image:1");
    assert.equal(resolveContainerImage(" app-image:1 ", null), "app-image:1");
    assert.equal(resolveContainerImage("app-image:1", "  "), "app-image:1");
  });

  it("does not prepend to images already containing a registry host", () => {
    assert.equal(
      resolveContainerImage(
        " ghcr.io/redroid/redroid:14 ",
        "registry.internal",
      ),
      "ghcr.io/redroid/redroid:14",
    );
    assert.equal(
      resolveContainerImage(" localhost/redroid:1 ", "registry.internal"),
      "localhost/redroid:1",
    );
  });
});
