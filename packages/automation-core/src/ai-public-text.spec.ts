import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { isPublicPlanText, normalizePublicAiText } from "./ai-public-text";

describe("public AI text", () => {
  it("normalizes JSON-like model text into markdown", () => {
    assert.equal(
      normalizePublicAiText(
        '{"Current screen":"Android home screen","Goal":"Enable system-wide dark mode"}',
      ),
      "- **Current screen:** Android home screen\n- **Goal:** Enable system-wide dark mode",
    );
    assert.equal(
      normalizePublicAiText(
        '{"Result":"Blocked"}\n{"Reason":"Settings path was not visible"}',
      ),
      "- **Result:** Blocked\n\n- **Reason:** Settings path was not visible",
    );
  });

  it("normalizes recognized plan labels and leaves ordinary prose intact", () => {
    const plan = [
      "Current screen: Home screen with search bar",
      "Goal: Turn on dark mode theme",
      "Next moves: Locate Settings using typed tools",
    ].join("\n");

    assert.equal(isPublicPlanText(plan), true);
    assert.equal(
      normalizePublicAiText(plan),
      [
        "- **Current screen:** Home screen with search bar",
        "- **Goal:** Turn on dark mode theme",
        "- **Next moves:** Locate Settings using typed tools",
      ].join("\n"),
    );
    assert.equal(
      normalizePublicAiText("A normal assistant response."),
      "A normal assistant response.",
    );
  });
});
