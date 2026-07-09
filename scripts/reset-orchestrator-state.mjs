import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { rmSync } from "node:fs";

const execute = process.argv.includes("--execute");
const root = resolve(new URL("..", import.meta.url).pathname);
const databasePath = resolve(
  root,
  process.env.DATABASE_PATH || "apps/orchestrator/data/orchestrator.sqlite",
);
const uploadsDirectory = resolve(
  root,
  process.env.UPLOADS_DIR || "apps/orchestrator/uploads",
);

const assertSafePath = (path) => {
  if (path === "/" || path === homedir() || path === root) {
    throw new Error(`Refusing to remove unsafe path: ${path}`);
  }
};

const removePath = (path) => {
  assertSafePath(path);
  console.log(`${execute ? "Removing" : "Would remove"} ${path}`);
  if (execute) rmSync(path, { recursive: true, force: true });
};

const dockerIds = (args) => {
  try {
    return execFileSync("docker", args, { encoding: "utf8" })
      .split(/\s+/)
      .map((value) => value.trim())
      .filter(Boolean);
  } catch (error) {
    if (!execute) return [];
    throw new Error(`Docker resource discovery failed: ${error.message}`);
  }
};

const removeDockerResources = (noun, ids, forceFlag = []) => {
  if (ids.length === 0) return;
  console.log(
    `${execute ? "Removing" : "Would remove"} Docker ${noun}: ${ids.join(", ")}`,
  );
  if (execute)
    execFileSync("docker", [noun, "rm", ...forceFlag, ...ids], {
      stdio: "inherit",
    });
};

const resetComposeVolumes = (volumeNames) => {
  const stateVolume = volumeNames.find(
    (name) =>
      name === "orchestrator-data" || name.endsWith("_orchestrator-data"),
  );
  const uploadsVolume = volumeNames.find(
    (name) =>
      name === "orchestrator-uploads" || name.endsWith("_orchestrator-uploads"),
  );
  if (!stateVolume && !uploadsVolume) return;

  const mounts = [
    ...(stateVolume ? ["--volume", `${stateVolume}:/reset-state`] : []),
    ...(uploadsVolume ? ["--volume", `${uploadsVolume}:/reset-uploads`] : []),
  ];
  const command = [
    stateVolume
      ? "rm -f /reset-state/orchestrator.sqlite /reset-state/orchestrator.sqlite-shm /reset-state/orchestrator.sqlite-wal"
      : "",
    uploadsVolume
      ? "rm -rf /reset-uploads/* /reset-uploads/.[!.]* /reset-uploads/..?*"
      : "",
  ]
    .filter(Boolean)
    .join("; ");
  const helperImage =
    process.env.RESET_HELPER_IMAGE || "localhost/rebroid/orchestrator:local";
  console.log(
    `${execute ? "Resetting" : "Would reset"} Compose volumes: ${[stateVolume, uploadsVolume].filter(Boolean).join(", ")}`,
  );
  if (execute) {
    execFileSync(
      "docker",
      [
        "run",
        "--rm",
        "--user",
        "0:0",
        ...mounts,
        "--entrypoint",
        "/bin/sh",
        helperImage,
        "-c",
        command,
      ],
      { stdio: "inherit" },
    );
  }
};

removePath(databasePath);
removePath(`${databasePath}-shm`);
removePath(`${databasePath}-wal`);
removePath(uploadsDirectory);

const containers = dockerIds([
  "container",
  "ls",
  "--all",
  "--quiet",
  "--filter",
  "label=com.rebroid.managed=true",
]);
const networks = dockerIds([
  "network",
  "ls",
  "--quiet",
  "--filter",
  "label=com.rebroid.managed=true",
]);
const volumes = dockerIds([
  "volume",
  "ls",
  "--quiet",
  "--filter",
  "label=com.rebroid.managed=true",
]);
const labeledImages = dockerIds([
  "image",
  "ls",
  "--quiet",
  "--filter",
  "label=com.rebroid.managed=true",
]);
const taggedImages = dockerIds([
  "image",
  "ls",
  "--quiet",
  "--filter",
  "reference=rebroid.local/managed:*",
]);
const composeVolumes = dockerIds([
  "volume",
  "ls",
  "--format",
  "{{.Name}}",
]).filter(
  (name) =>
    name === "orchestrator-data" ||
    name.endsWith("_orchestrator-data") ||
    name === "orchestrator-uploads" ||
    name.endsWith("_orchestrator-uploads"),
);

removeDockerResources("container", containers, ["--force"]);
resetComposeVolumes(composeVolumes);
removeDockerResources("network", networks);
removeDockerResources("volume", volumes, ["--force"]);
removeDockerResources(
  "image",
  [...new Set([...labeledImages, ...taggedImages])],
  ["--force"],
);

if (!execute) {
  console.log(
    "Dry run only. Re-run with --execute after stopping the orchestrator.",
  );
}
