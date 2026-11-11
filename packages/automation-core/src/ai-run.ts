export const AUTOMATION_AI_RUN_MAX_TIMEOUT_MS = 900_000;

export const AUTOMATION_AI_DEFAULT_CAPABILITIES_HEADER =
  "x-rebroid-ai-default-capabilities";

const fixedActionUses = new Set([
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
]);

const defaultRoutedUses = new Set([
  "android.listPackages",
  "android.getSetting",
  "android.getClipboard",
]);

const excludedUses = new Set([
  "ai.run",
  "android.adbShell",
  "android.tap",
  "android.tapText",
]);

export const isDefaultAiCapability = (uses: string) =>
  fixedActionUses.has(uses) || defaultRoutedUses.has(uses);

export const isSelectableAiCapability = (uses: string) =>
  !excludedUses.has(uses);

export const isRoutedAiCapability = (uses: string) =>
  isSelectableAiCapability(uses) && !fixedActionUses.has(uses);
