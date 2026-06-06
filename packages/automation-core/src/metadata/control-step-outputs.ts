import type { AutomationCommandOutputMetadata } from "../definition";

export const controlStepOutputs: Record<
  string,
  AutomationCommandOutputMetadata[]
> = {
  "flow.condition": [
    {
      key: "summary",
      label: "Summary",
      type: "string",
      description: "Human-readable condition result.",
    },
    {
      key: "matched",
      label: "Matched",
      type: "boolean",
      description: "Whether the condition matched.",
    },
    {
      key: "branch",
      label: "Branch",
      type: "string",
      description: "Selected branch name.",
    },
  ],
  "flow.switch": [
    {
      key: "summary",
      label: "Summary",
      type: "string",
      description: "Human-readable switch result.",
    },
    {
      key: "value",
      label: "Selected value",
      type: "unknown",
      description: "Value used to select the switch branch.",
    },
    {
      key: "matchedCaseIndex",
      label: "Matched case index",
      type: "number",
      description: "Zero-based matched case index, or empty for default.",
    },
    {
      key: "branch",
      label: "Branch",
      type: "string",
      description: "Selected branch name.",
    },
  ],
  "flow.repeat": [
    {
      key: "summary",
      label: "Summary",
      type: "string",
      description: "Human-readable repeat result.",
    },
    {
      key: "iterations",
      label: "Iterations",
      type: "number",
      description: "Number of completed loop iterations.",
    },
    {
      key: "mode",
      label: "Mode",
      type: "string",
      description: "Repeat mode.",
    },
    {
      key: "maxIterations",
      label: "Max iterations",
      type: "number",
      description: "Configured repeat iteration limit.",
    },
  ],
};
