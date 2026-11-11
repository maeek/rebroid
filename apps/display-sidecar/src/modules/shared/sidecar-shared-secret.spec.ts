import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

test("reads a shared secret published after display sidecar startup", async () => {
  const directory = await mkdtemp(join(tmpdir(), "rebroid-display-secret-"));
  const secretFile = join(directory, "rebroid-shared-secret");
  const previousInline = process.env.DISPLAY_SIDECAR_SHARED_SECRET;
  const previousFile = process.env.DISPLAY_SIDECAR_SHARED_SECRET_FILE;
  try {
    await writeFile(secretFile, "", { mode: 0o600 });
    delete process.env.DISPLAY_SIDECAR_SHARED_SECRET;
    process.env.DISPLAY_SIDECAR_SHARED_SECRET_FILE = secretFile;
    const { SidecarConfigService } =
      await import("./sidecar-config.service.js");
    const config = new SidecarConfigService();

    assert.equal(config.hasSharedSecret, false);
    await writeFile(secretFile, "fixture-secret\n", { mode: 0o600 });
    assert.equal(config.sharedSecret, "fixture-secret");
    assert.equal(config.hasSharedSecret, true);
  } finally {
    if (previousInline === undefined)
      delete process.env.DISPLAY_SIDECAR_SHARED_SECRET;
    else process.env.DISPLAY_SIDECAR_SHARED_SECRET = previousInline;
    if (previousFile === undefined)
      delete process.env.DISPLAY_SIDECAR_SHARED_SECRET_FILE;
    else process.env.DISPLAY_SIDECAR_SHARED_SECRET_FILE = previousFile;
    await rm(directory, { recursive: true, force: true });
  }
});
