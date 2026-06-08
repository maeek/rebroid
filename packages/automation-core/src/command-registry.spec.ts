import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  buildCommandEditorMetadata,
  normalizeCommandOutputs,
  summaryOutput,
} from "./command-registry";

describe("automation command registry helpers", () => {
  it("normalizes outputs and preserves summary precedence", () => {
    const normalized = normalizeCommandOutputs([
      {
        key: "summary",
        label: "Custom summary",
        type: "string",
        description: "Should be deduplicated",
      },
      {
        key: "status",
        label: "Status",
        type: "string",
        description: "Actual step status.",
      },
    ]);

    assert.equal(normalized[0].key, "summary");
    assert.equal(normalized[1].key, "status");
    assert.equal(normalized[0], summaryOutput);
  });

  it("deduplicates outputs after schema extension", () => {
    const normalized = normalizeCommandOutputs([
      summaryOutput,
      { key: "summary", label: "Again", type: "string", description: "x" },
      {
        key: "status",
        label: "Status",
        type: "string",
        description: "Primary status.",
      },
      {
        key: "status",
        label: "Status 2",
        type: "string",
        description: "Secondary status.",
      },
    ]);

    assert.deepEqual(
      normalized.map((output) => output.key),
      ["summary", "status"],
    );
  });

  it("builds editor metadata from schema defaults and overrides", () => {
    const metadata = buildCommandEditorMetadata(
      {
        properties: {
          command: { type: "string" },
          timeoutMs: { type: "number", default: 15000 },
        },
        required: ["command"],
      },
      {
        inputFieldOrder: ["timeoutMs", "command"],
        inputDefaults: { command: "default" },
        category: "android",
      },
    );

    assert.equal(metadata.category, "android");
    assert.equal(metadata.yamlSnippetFields[0], "timeoutMs");
    assert.equal(metadata.inputDefaults.timeoutMs, 15000);
  });

  it("uses schema-derived defaults and required fields when no override is given", () => {
    const metadata = buildCommandEditorMetadata({
      properties: {
        command: { type: "string", default: "input", description: "Command" },
        timeoutMs: { type: "number", default: 4000 },
        retries: { type: "number", description: "Retries" },
      },
      required: ["command", "retries"],
    });

    assert.deepEqual(metadata.inputFieldOrder, [
      "command",
      "timeoutMs",
      "retries",
    ]);
    assert.equal(metadata.inputDefaults.command, "input");
    assert.equal(metadata.inputDefaults.timeoutMs, 4000);
    assert.deepEqual(metadata.yamlSnippetFields, [
      "command",
      "timeoutMs",
      "retries",
    ]);
  });
});
