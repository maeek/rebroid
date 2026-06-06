import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  conditionOperators,
  controlStepOutputs,
  operatorsForType,
  runContextOutputs,
  unaryOperators,
} from "./metadata";

describe("automation metadata", () => {
  it("keeps condition operator metadata internally consistent", () => {
    assert.deepEqual(operatorsForType("boolean"), [
      "isTrue",
      "isFalse",
      "exists",
      "doesNotExist",
    ]);
    for (const operator of unaryOperators) {
      assert.ok(conditionOperators.includes(operator));
    }
  });

  it("exposes run-context and control-step outputs used by editor and runner", () => {
    assert.ok(runContextOutputs.some((output) => output.key === "runId"));
    assert.deepEqual(
      controlStepOutputs["flow.condition"]?.map((output) => output.key),
      ["summary", "matched", "branch"],
    );
  });
});
