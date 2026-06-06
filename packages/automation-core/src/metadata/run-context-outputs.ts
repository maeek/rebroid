import type { AutomationCommandOutputMetadata } from "../definition";

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
