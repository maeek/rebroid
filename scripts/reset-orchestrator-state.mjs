import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import {
  composeVolumeMatches,
  dockerIds,
  execute,
  managedIds,
  removeLocalState,
  removeResources,
  root,
} from "./state-reset.mjs";

const databasePath = resolve(
  root,
  process.env.DATABASE_PATH || "apps/orchestrator/data/orchestrator.sqlite",
);
const uploadsDirectory = resolve(
  root,
  process.env.UPLOADS_DIR || "apps/orchestrator/uploads",
);

const resetComposeVolumes = (volumeNames) => {
  const stateVolume = volumeNames.find((name) =>
    composeVolumeMatches(name, "orchestrator-data"),
  );
  const uploadsVolume = volumeNames.find((name) =>
    composeVolumeMatches(name, "orchestrator-uploads"),
  );
  if (!stateVolume && !uploadsVolume) return;

  const mounts = [
    ...(stateVolume ? ["--volume", `${stateVolume}:/reset-state`] : []),
    ...(uploadsVolume ? ["--volume", `${uploadsVolume}:/reset-uploads`] : []),
  ];
  const command = [
    stateVolume
      ? "rm -f /reset-state/orchestrator.sqlite /reset-state/orchestrator.sqlite-shm /reset-state/orchestrator.sqlite-wal && rm -rf /reset-state/runtime-snapshots"
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

const containers = managedIds("container");
const networks = managedIds("network");
const volumes = managedIds("volume");
const labeledImages = managedIds("image");
const taggedImages = dockerIds([
  "image",
  "ls",
  "--quiet",
  "--filter",
  "reference=rebroid.local/managed:*",
]);
const composeVolumes = dockerIds(["volume", "ls", "--format", "{{.Name}}"]);

removeLocalState(
  [
    ...[databasePath, `${databasePath}-shm`, `${databasePath}-wal`].map(
      (path) => ({ path, directory: false }),
    ),
    {
      path: resolve(dirname(databasePath), "runtime-snapshots"),
      directory: true,
    },
    { path: uploadsDirectory, directory: true },
  ],
  {
    protectedPaths: [
      resolve(
        root,
        process.env.SETTINGS_PATH ||
          "apps/orchestrator/data/orchestrator-settings.json",
      ),
    ],
  },
);

removeResources("container", containers, ["--force"]);
resetComposeVolumes(composeVolumes);
removeResources("network", networks);
removeResources("volume", volumes, ["--force"]);
removeResources(
  "image",
  [...new Set([...labeledImages, ...taggedImages])],
  ["--force"],
);

if (!execute) {
  console.log(
    "Dry run only. Re-run with --execute after stopping the orchestrator.",
  );
}
