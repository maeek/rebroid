import type {
  AutomationCommandOutputMetadata,
  AutomationConditionOperator,
  AutomationValueType,
} from "./definition";

export const runContextOutputs: AutomationCommandOutputMetadata[] = [
  {
    key: "runId",
    label: "Run ID",
    type: "string",
    description: "Current automation run identifier.",
  },
  {
    key: "trigger",
    label: "Trigger",
    type: "string",
    description: "How the automation run started.",
  },
  {
    key: "targetApplicationId",
    label: "Target application ID",
    type: "string",
    description: "Application selected for this run.",
  },
  {
    key: "targetProfileMode",
    label: "Target profile mode",
    type: "string",
    description: "Profile mode selected for this run.",
  },
  {
    key: "targetProfileName",
    label: "Target profile name",
    type: "string",
    description: "Profile name selected for this run.",
  },
  {
    key: "app.id",
    label: "Application ID",
    type: "string",
    description: "Current application identifier.",
  },
  {
    key: "app.packageName",
    label: "Package name",
    type: "string",
    description: "Android package name.",
  },
  {
    key: "app.status",
    label: "Application status",
    type: "string",
    description: "Current application runtime status.",
  },
  {
    key: "app.profileName",
    label: "Active profile name",
    type: "string",
    description: "Currently active profile name.",
  },
  {
    key: "app.profileMode",
    label: "Active profile mode",
    type: "string",
    description: "Currently active profile mode.",
  },
];

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

export const conditionOperators: AutomationConditionOperator[] = [
  "equals",
  "notEquals",
  "contains",
  "doesNotContain",
  "exists",
  "doesNotExist",
  "isEmpty",
  "isNotEmpty",
  "isTrue",
  "isFalse",
  "greaterThan",
  "greaterThanOrEqual",
  "lessThan",
  "lessThanOrEqual",
  "matches",
  "lengthEquals",
  "lengthGreaterThan",
  "lengthLessThan",
];

export const unaryOperators = new Set<AutomationConditionOperator>([
  "exists",
  "doesNotExist",
  "isEmpty",
  "isNotEmpty",
  "isTrue",
  "isFalse",
]);

export const operatorLabels: Record<AutomationConditionOperator, string> = {
  equals: "equals",
  notEquals: "does not equal",
  contains: "contains",
  doesNotContain: "does not contain",
  exists: "exists",
  doesNotExist: "does not exist",
  isEmpty: "is empty",
  isNotEmpty: "is not empty",
  isTrue: "is true",
  isFalse: "is false",
  greaterThan: "is greater than",
  greaterThanOrEqual: "is greater than or equal to",
  lessThan: "is less than",
  lessThanOrEqual: "is less than or equal to",
  matches: "matches regex",
  lengthEquals: "length equals",
  lengthGreaterThan: "length is greater than",
  lengthLessThan: "length is less than",
};

export const operatorsForType = (
  type: AutomationValueType,
): AutomationConditionOperator[] => {
  if (type === "boolean") {
    return ["isTrue", "isFalse", "exists", "doesNotExist"];
  }
  if (type === "number") {
    return [
      "equals",
      "notEquals",
      "greaterThan",
      "greaterThanOrEqual",
      "lessThan",
      "lessThanOrEqual",
      "exists",
    ];
  }
  if (type === "array") {
    return [
      "isEmpty",
      "isNotEmpty",
      "contains",
      "lengthEquals",
      "lengthGreaterThan",
      "lengthLessThan",
      "exists",
    ];
  }
  if (type === "string") {
    return [
      "exists",
      "doesNotExist",
      "isEmpty",
      "isNotEmpty",
      "equals",
      "notEquals",
      "contains",
      "doesNotContain",
      "matches",
    ];
  }
  return ["exists", "doesNotExist", "equals", "notEquals"];
};
