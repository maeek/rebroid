import { execFileSync } from "node:child_process";
import { copyFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const viewerOutput = join(root, "dist/modules/display/viewer");
// The server build also emits the shared SPS parser under viewer/src.
await rm(join(viewerOutput, "assets"), { recursive: true, force: true });

execFileSync(
  process.execPath,
  [
    join(root, "node_modules/typescript/bin/tsc"),
    "-p",
    "src/modules/display/viewer/tsconfig.json",
  ],
  { cwd: root, stdio: "inherit" },
);

await mkdir(viewerOutput, { recursive: true });
await copyFile(
  join(root, "src/modules/display/viewer/index.html"),
  join(viewerOutput, "index.html"),
);
