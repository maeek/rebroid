import { execFileSync } from "node:child_process";
import { copyFile, mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";

const root = process.cwd();
const viewerOutput = join(root, "dist/modules/display/viewer");
await rm(viewerOutput, { recursive: true, force: true });

execFileSync(
  process.execPath,
  [
    join(root, "node_modules/typescript/bin/tsc"),
    "-p",
    "src/modules/display/viewer/tsconfig.json",
  ],
  { cwd: root, stdio: "inherit" },
);

const assets = [
  [
    "src/modules/display/viewer/index.html",
    "dist/modules/display/viewer/index.html",
  ],
  [
    "src/modules/display/viewer/styles.css",
    "dist/modules/display/viewer/assets/styles.css",
  ],
];
await Promise.all(
  assets.map(async ([source, target]) => {
    const destination = join(root, target);
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(join(root, source), destination);
  }),
);
