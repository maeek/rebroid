import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  extractUiDetections,
  matchesDetectionQuery,
  sortDetections,
} from "./observation";

describe("vision core UI XML detection parsing", () => {
  it("extracts bounds from UI hierarchy nodes", () => {
    const xml =
      '<hierarchy><node text="Play" bounds="[10,20][110,150]" resource-id="com.example:id/play"/>' +
      '<node content-desc="Back" bounds="[0,0][60,60]" class="android.widget.Button"/>' +
      "</hierarchy>";
    const detections = extractUiDetections(xml, { width: 200, height: 300 });

    assert.equal(detections.length, 2);
    assert.equal(detections[0].label, "Play");
    assert.equal(detections[1].label, "Back");
    assert.equal(detections[0].bounds.left, 10 / 200);
    assert.equal(detections[0].bounds.top, 20 / 300);
  });

  it("matches detection query by label, text, role, and description", () => {
    const matches = matchesDetectionQuery(
      {
        id: "1",
        label: "Play",
        text: "Start",
        role: "Button",
        description: "Primary action",
        confidence: 1,
        bounds: {
          left: 0.1,
          top: 0.2,
          width: 0.2,
          height: 0.3,
        },
        center: { x: 0.2, y: 0.35 },
        source: "ui-xml",
      },
      "Primary ACTION",
    );
    assert.equal(matches, true);
  });

  it("sorts by confidence then position", () => {
    const sorted = sortDetections([
      {
        id: "a",
        label: "A",
        confidence: 0.5,
        bounds: { left: 0.2, top: 0.3, width: 0.1, height: 0.1 },
        center: { x: 0.25, y: 0.35 },
        source: "ui-xml",
      },
      {
        id: "b",
        label: "B",
        confidence: 0.8,
        bounds: { left: 0.1, top: 0.2, width: 0.1, height: 0.1 },
        center: { x: 0.15, y: 0.25 },
        source: "ui-xml",
      },
      {
        id: "c",
        label: "C",
        confidence: 0.8,
        bounds: { left: 0.05, top: 0.1, width: 0.1, height: 0.1 },
        center: { x: 0.1, y: 0.15 },
        source: "ui-xml",
      },
    ]);
    assert.equal(sorted[0].id, "c");
    assert.equal(sorted[1].id, "b");
    assert.equal(sorted[2].id, "a");
  });
});
