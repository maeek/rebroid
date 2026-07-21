import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const generatedContracts = new Set([
  "@rebroid/display-sidecar-contracts",
  "@rebroid/orchestrator-contracts",
]);

const manifestDirectories = async (directory) =>
  (await readdir(resolve(root, directory), { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => resolve(root, directory, entry.name));

const readManifests = async (parent) => {
  const manifests = [];
  for (const directory of await manifestDirectories(parent)) {
    try {
      manifests.push({
        directory,
        manifest: JSON.parse(
          await readFile(resolve(directory, "package.json"), "utf8"),
        ),
      });
    } catch (error) {
      if (error?.code !== "ENOENT") {
        throw error;
      }
    }
  }
  return manifests;
};

const usesPackage = async (directory, packageName) => {
  const sourceDirectory = resolve(directory, "src");
  const files = await readdir(sourceDirectory, { recursive: true });
  for (const file of files) {
    if (!/\.[cm]?[jt]sx?$/.test(file)) continue;
    const source = await readFile(resolve(sourceDirectory, file), "utf8");
    if (
      source.includes(`'${packageName}`) ||
      source.includes(`"${packageName}`)
    ) {
      return true;
    }
  }
  return false;
};

const packageManifests = await readManifests("packages");
const appManifests = await readManifests("apps");

const failures = [];
for (const { manifest } of packageManifests) {
  if (!manifest.private) {
    failures.push(
      `${manifest.name} must remain private until a publishing policy is approved.`,
    );
  }
  if (!manifest.description) {
    failures.push(`${manifest.name} must describe its ownership and purpose.`);
  }
  if (generatedContracts.has(manifest.name)) {
    continue;
  }

  const consumers = [];
  for (const app of appManifests) {
    if (
      Object.hasOwn(app.manifest.dependencies ?? {}, manifest.name) &&
      (await usesPackage(app.directory, manifest.name))
    ) {
      consumers.push(app.manifest.name);
    }
  }
  if (consumers.length < 2) {
    failures.push(
      `${manifest.name} has ${consumers.length} runtime app consumer(s); handwritten packages require at least two.`,
    );
  }
}

if (failures.length > 0) {
  throw new Error(`Package boundary check failed:\n- ${failures.join("\n- ")}`);
}

console.log(`Validated ${packageManifests.length} package boundaries.`);
