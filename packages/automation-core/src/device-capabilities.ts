import { visitAutomationSteps, type AutomationDefinition } from "./definition";

export type ExternalAutomationCapability =
  "neutral" | "screen" | "input" | "clipboard";

const externalCapabilities: Readonly<
  Record<string, ExternalAutomationCapability>
> = {
  "android.wait": "neutral",
  "debug.log": "neutral",
  "flow.stop": "neutral",
  "flow.fail": "neutral",
  "ai.run": "screen",
  "vision.observe": "screen",
  "vision.locate": "screen",
  "android.screenshot": "screen",
  "android.tap": "input",
  "android.tapNormalized": "input",
  "android.swipe": "input",
  "android.swipeNormalized": "input",
  "android.inputText": "input",
  "android.key": "input",
  "android.launchPackage": "input",
  "android.viewerCommand": "input",
  "android.expandQuickSettings": "input",
  "android.collapsePanels": "input",
  "android.getClipboard": "clipboard",
  "android.setClipboard": "clipboard",
};

export const externalAutomationCapability = (uses: string) =>
  Object.hasOwn(externalCapabilities, uses)
    ? externalCapabilities[uses]
    : undefined;

export function externalDefinitionIssue(
  definition: AutomationDefinition,
): string | undefined {
  let issue: string | undefined;
  visitAutomationSteps(definition.spec.steps, (step) => {
    if (issue || !("uses" in step)) return;
    if (!externalAutomationCapability(step.uses)) {
      issue = `Step "${step.id}" uses "${step.uses}", which this external device does not support.`;
    } else if (
      step.uses === "android.launchPackage" &&
      typeof step.with.packageName !== "string"
    ) {
      issue = `Step "${step.id}" needs an explicit Android package name for an external device.`;
    } else if (
      step.uses === "android.viewerCommand" &&
      step.with.command === "rotate"
    ) {
      issue = `Step "${step.id}" requests display rotation, which external devices do not support.`;
    } else if (step.uses === "ai.run") {
      if (step.with.rawShellPolicy === "allowlisted") {
        issue = `Step "${step.id}" requests ADB shell access, which external devices do not support.`;
      } else if (Array.isArray(step.with.capabilities)) {
        const unsupported = step.with.capabilities.some(
          (uses: unknown) =>
            typeof uses !== "string" || !externalAutomationCapability(uses),
        );
        if (unsupported) {
          issue = `Step "${step.id}" requests an AI capability unavailable on external devices.`;
        }
      }
    }
  });
  return issue;
}
