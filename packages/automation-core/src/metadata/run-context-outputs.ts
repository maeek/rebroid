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
    key: "targetDeviceId",
    label: "Target device ID",
    type: "string",
    description: "Device selected for this run.",
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
    key: "device.id",
    label: "Device ID",
    type: "string",
    description: "Current device identifier.",
  },
  {
    key: "device.kind",
    label: "Device kind",
    type: "string",
    description: "Managed or external.",
  },
  {
    key: "device.packageName",
    label: "Package name",
    type: "string",
    description: "Android package configured on a managed device.",
  },
  {
    key: "device.status",
    label: "Device status",
    type: "string",
    description: "Current runtime or attachment status.",
  },
  {
    key: "device.profileName",
    label: "Active profile name",
    type: "string",
    description: "Active profile name on a managed device.",
  },
  {
    key: "device.profileMode",
    label: "Active profile mode",
    type: "string",
    description: "Active profile mode on a managed device.",
  },
];
