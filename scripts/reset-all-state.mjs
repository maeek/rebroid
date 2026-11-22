import { resolve } from "node:path";
import {
  composeVolumeMatches,
  dockerIds,
  execute,
  managedIds,
  removeLocalState,
  removeResources,
  root,
} from "./state-reset.mjs";

const localStatePaths = [
  resolve(root, "apps/web/data"),
  resolve(root, "apps/orchestrator/data"),
  resolve(root, "apps/orchestrator/uploads"),
];

const activeContainers = dockerIds([
  "container",
  "ls",
  "--quiet",
  "--filter",
  "name=rebroid-",
]);

if (execute && activeContainers.length > 0) {
  throw new Error(
    "Rebroid containers are still running. Stop the complete stack before resetting state.",
  );
}

const composeVolumeNames = [
  "orchestrator-data",
  "orchestrator-uploads",
  "web-data",
  "shared-secrets",
  "firewall-agent-run",
];
const volumes = dockerIds(["volume", "ls", "--format", "{{.Name}}"]).filter(
  (name) =>
    composeVolumeNames.some((volume) => composeVolumeMatches(name, volume)),
);
const managedContainers = managedIds("container");
const managedNetworks = managedIds("network");
const managedVolumes = managedIds("volume");

removeLocalState(
  localStatePaths.map((path) => ({ path, directory: true })),
  { withinRoot: true },
);
removeResources("container", managedContainers, ["--force"]);
removeResources("network", managedNetworks);
removeResources(
  "volume",
  [...new Set([...volumes, ...managedVolumes])],
  ["--force"],
);

if (!execute) {
  console.log(
    "Dry run only. Stop the complete Rebroid stack, review this list, then re-run with --execute.",
  );
}
