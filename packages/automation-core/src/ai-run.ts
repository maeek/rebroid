export const AUTOMATION_AI_RUN_MAX_TIMEOUT_MS = 900_000;

export const AUTOMATION_AI_DEFAULT_CAPABILITIES_HEADER =
  "x-rebroid-ai-default-capabilities";

const fixedActionUses = [
  "android.tapNormalized",
  "android.swipeNormalized",
  "android.inputText",
  "android.key",
  "android.launchPackage",
  "android.openSystemSettings",
  "android.expandNotifications",
  "android.expandQuickSettings",
  "android.viewerCommand",
  "android.wait",
] as const;

const defaultRoutedUses = [
  "vision.locate",
  "vision.observe",
  "android.listPackages",
  "android.getSetting",
  "android.getClipboard",
] as const;

const optionalRoutedUses = [
  "android.collapsePanels",
  "android.rotateDisplay",
  "android.setClipboard",
  "android.fileExists",
  "android.listFiles",
  "android.pullFile",
  "android.pushFile",
  "android.deleteFile",
  "container.network.allowCidr",
  "container.network.removeAllowedCidr",
  "container.network.clearAllowedCidrs",
  "container.network.setRestrictions",
  "container.network.resetPolicy",
] as const;

export type RoutedAiCapability =
  (typeof defaultRoutedUses)[number] | (typeof optionalRoutedUses)[number];

const defaultCapabilities = new Set<string>([
  ...fixedActionUses,
  ...defaultRoutedUses,
]);
const routedCapabilities = new Set<string>([
  ...defaultRoutedUses,
  ...optionalRoutedUses,
]);

export const isDefaultAiCapability = (uses: string) =>
  defaultCapabilities.has(uses);

export const isSelectableAiCapability = (uses: string) =>
  defaultCapabilities.has(uses) || routedCapabilities.has(uses);

export const isRoutedAiCapability = (
  uses: string,
): uses is RoutedAiCapability => routedCapabilities.has(uses);
