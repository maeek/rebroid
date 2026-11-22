import { execFileSync } from "node:child_process";
import { lstatSync, realpathSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, resolve, sep } from "node:path";

export const execute = process.argv.includes("--execute");
export const root = resolve(import.meta.dirname, "..");

const contains = (parent, path) =>
  parent === path ||
  path.startsWith(parent.endsWith(sep) ? parent : parent + sep);

// Resolve existing ancestors even when the state file has not been created yet.
const physicalPath = (path) => {
  try {
    return realpathSync(path);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return resolve(physicalPath(dirname(path)), basename(path));
  }
};

export const removeLocalState = (
  targets,
  { protectedPaths = [], withinRoot = false } = {},
) => {
  const protectedLocations = [root, homedir(), ...protectedPaths].map(
    physicalPath,
  );
  for (const { path, directory } of targets) {
    const location = physicalPath(path);
    if (
      (withinRoot && !contains(root, location)) ||
      protectedLocations.some(
        (protectedPath) =>
          location === protectedPath ||
          (directory && contains(location, protectedPath)),
      )
    ) {
      throw new Error(`Refusing to remove unsafe path: ${path}`);
    }
    const info = lstatSync(path, { throwIfNoEntry: false });
    if (info && !info.isSymbolicLink() && directory !== info.isDirectory()) {
      throw new Error(`Unexpected state path type: ${path}`);
    }
  }
  for (const { path, directory } of targets) {
    console.log(`${execute ? "Removing" : "Would remove"} ${path}`);
    if (execute) rmSync(path, { recursive: directory, force: true });
  }
};

export const dockerIds = (args) => {
  try {
    return execFileSync("docker", args, { encoding: "utf8" })
      .split(/\s+/)
      .filter(Boolean);
  } catch (error) {
    if (!execute) return [];
    throw new Error(`Docker resource discovery failed: ${error.message}`);
  }
};

export const managedIds = (noun) =>
  dockerIds([
    noun,
    "ls",
    ...(noun === "container" ? ["--all"] : []),
    "--quiet",
    "--filter",
    "label=com.rebroid.managed=true",
  ]);

export const composeVolumeMatches = (name, volume) =>
  name === volume || name.endsWith(`_${volume}`);

export const removeResources = (noun, ids, flags = []) => {
  if (!ids.length) return;
  console.log(
    `${execute ? "Removing" : "Would remove"} Docker ${noun}: ${ids.join(", ")}`,
  );
  if (execute)
    execFileSync("docker", [noun, "rm", ...flags, ...ids], {
      stdio: "inherit",
    });
};
