import { readFile, readdir } from "node:fs/promises";
import { resolve, sep } from "node:path";
import ts from "typescript";

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

const packageManifests = await readManifests("packages");
const appManifests = await readManifests("apps");
const consumers = new Map(
  packageManifests
    .filter(({ manifest }) => !generatedContracts.has(manifest.name))
    .map(({ manifest }) => [manifest.name, new Set()]),
);

for (const { directory, manifest } of appManifests) {
  const remaining = new Set(
    Object.keys(manifest.dependencies ?? {}).filter((name) =>
      consumers.has(name),
    ),
  );
  if (!remaining.size) continue;
  const src = resolve(directory, "src");
  for (const file of await readdir(src, { recursive: true })) {
    if (!/\.[cm]?[jt]sx?$/.test(file) || /\.(?:spec|test)\.[^.]+$/.test(file))
      continue;
    if (
      file
        .split(sep)
        .some((part) =>
          ["test", "tests", "__tests__", "__mocks__"].includes(part),
        )
    )
      continue;
    const source = await readFile(resolve(src, file), "utf8");
    const candidates = [...remaining].filter((name) => source.includes(name));
    if (!candidates.length) continue;
    const { importedFiles } = ts.preProcessFile(source, true, true);
    for (const name of candidates) {
      if (
        importedFiles.some(
          ({ fileName }) =>
            fileName === name || fileName.startsWith(name + "/"),
        )
      ) {
        consumers.get(name).add(manifest.name);
        remaining.delete(name);
      }
    }
    if (!remaining.size) break;
  }
}

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

  const count = consumers.get(manifest.name).size;
  if (count < 2) {
    failures.push(
      `${manifest.name} has ${count} runtime app consumer(s); handwritten packages require at least two.`,
    );
  }
}

if (failures.length > 0) {
  throw new Error(`Package boundary check failed:\n- ${failures.join("\n- ")}`);
}

console.log(`Validated ${packageManifests.length} package boundaries.`);
