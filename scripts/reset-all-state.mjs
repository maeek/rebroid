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
  resolve(root, "apps/display-sidecar/data/external-adb-keys"),
];

const composeVolumeNames = [
  "orchestrator-data",
  "orchestrator-uploads",
  "web-data",
  "shared-secrets",
  "firewall-agent-run",
  "external-adb-keys",
  "external-adb-no-usb",
];
const volumes = dockerIds(["volume", "ls", "--format", "{{.Name}}"]).filter(
  (name) =>
    composeVolumeNames.some((volume) => composeVolumeMatches(name, volume)),
);
const managedContainers = managedIds("container");
const managedNetworks = managedIds("network");
const managedVolumes = managedIds("volume");
const volumesToRemove = [...new Set([...volumes, ...managedVolumes])];

const hasRunningContainer = (filter) =>
  dockerIds(["container", "ls", "--quiet", "--filter", filter]).length > 0;

if (
  execute &&
  (hasRunningContainer("label=com.rebroid.managed=true") ||
    volumesToRemove.some((volume) => hasRunningContainer(`volume=${volume}`)))
) {
  throw new Error(
    "Rebroid containers are still running. Stop the complete stack before resetting state.",
  );
}

removeLocalState(
  localStatePaths.map((path) => ({ path, directory: true })),
  { withinRoot: true },
);
removeResources("container", managedContainers, ["--force"]);
removeResources("network", managedNetworks);
removeResources("volume", volumesToRemove, ["--force"]);

if (!execute) {
  console.log(
    "Dry run only. Stop the complete Rebroid stack, review this list, then re-run with --execute.",
  );
}
