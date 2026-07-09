import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const check = process.argv.includes("--check");
const fetchSpecs = process.argv.includes("--fetch");
const requestedContract = process.argv
  .find((argument) => argument.startsWith("--contract="))
  ?.split("=", 2)[1];

const contracts = [
  {
    name: "orchestrator",
    spec: "packages/orchestrator-client/openapi.json",
    schema: "packages/orchestrator-client/src/schema.ts",
    url:
      process.env.ORCHESTRATOR_OPENAPI_URL || "http://127.0.0.1:4100/docs-json",
  },
  {
    name: "display-sidecar",
    spec: "packages/sidecar-client/openapi.json",
    schema: "packages/sidecar-client/src/schema.ts",
    url:
      process.env.SIDECAR_OPENAPI_URL ||
      "http://127.0.0.1:8000/docs/openapi.json",
  },
];

const selectedContracts = requestedContract
  ? contracts.filter((contract) => contract.name === requestedContract)
  : contracts;

if (requestedContract && selectedContracts.length === 0) {
  throw new Error(`Unknown OpenAPI contract "${requestedContract}".`);
}

for (const contract of selectedContracts) {
  const specPath = resolve(root, contract.spec);
  const schemaPath = resolve(root, contract.schema);
  if (fetchSpecs) {
    const response = await fetch(contract.url);
    if (!response.ok)
      throw new Error(
        `Could not fetch ${contract.name} OpenAPI document: ${response.status}`,
      );
    mkdirSync(dirname(specPath), { recursive: true });
    writeFileSync(
      specPath,
      `${JSON.stringify(await response.json(), null, 2)}\n`,
    );
  }

  const temporaryPath = check ? `${schemaPath}.check` : schemaPath;
  mkdirSync(dirname(schemaPath), { recursive: true });
  execFileSync(
    resolve(root, "node_modules/.bin/openapi-typescript"),
    [specPath, "--output", temporaryPath],
    {
      cwd: root,
      stdio: "inherit",
    },
  );
  if (check) {
    const expected = readFileSync(schemaPath, "utf8");
    const actual = readFileSync(temporaryPath, "utf8");
    rmSync(temporaryPath);
    if (actual !== expected)
      throw new Error(
        `${contract.name} generated schema is stale. Run pnpm openapi:generate.`,
      );
  }
}
