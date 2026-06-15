export type AiScreenKind =
  | "home"
  | "quick_settings"
  | "notification_shade"
  | "settings_app"
  | "app_screen"
  | "unknown";

export interface AiScreenStateHypothesis {
  screenKind: AiScreenKind;
  confidence: number;
  visibleText: string[];
  controls: Array<{ label: string; role?: string }>;
  evidence: string[];
  uncertainty: string[];
  summary: string;
}

export interface ScreenStateCorrectionResult {
  screenKind: AiScreenKind;
  confidence: number;
  correctionReason?: string;
  settingsAccessVisible: boolean;
}

const quickSettingsLandmarks = [
  "internet",
  "bluetooth",
  "do not disturb",
  "airplane mode",
  "auto-rotate",
  "battery saver",
  "brightness",
  "quick settings",
  "notification shade",
];

const settingsAccessLandmarks = ["settings", "gear"];

const haystackForScreenState = (state: AiScreenStateHypothesis) =>
  [
    ...state.visibleText,
    ...state.evidence,
    ...state.uncertainty,
    state.summary,
    ...state.controls.flatMap((control) => [control.label, control.role ?? ""]),
  ]
    .join("\n")
    .toLowerCase();

export const correctScreenStateHypothesis = (
  state: AiScreenStateHypothesis,
): ScreenStateCorrectionResult => {
  const haystack = haystackForScreenState(state);
  const matchedQuickSettings = quickSettingsLandmarks.filter((landmark) =>
    haystack.includes(landmark),
  );
  const settingsAccessVisible = settingsAccessLandmarks.some((landmark) =>
    haystack.includes(landmark),
  );

  if (state.screenKind === "settings_app" && matchedQuickSettings.length >= 2) {
    return {
      screenKind: "quick_settings",
      confidence: Math.min(state.confidence, 0.65),
      correctionReason: `Quick-settings landmarks detected: ${matchedQuickSettings
        .slice(0, 4)
        .join(", ")}.`,
      settingsAccessVisible,
    };
  }

  return {
    screenKind: state.screenKind,
    confidence: state.confidence,
    settingsAccessVisible,
  };
};

export const isSettingsOpenClaimConfirmed = ({
  screenKind,
  confirmedFacts,
  visibleText,
}: {
  screenKind: AiScreenKind | null;
  confirmedFacts: string[];
  visibleText?: string[];
}) => {
  if (screenKind === "quick_settings" || screenKind === "notification_shade") {
    return false;
  }
  if (
    confirmedFacts.some((fact) =>
      /android\.(openSystemSettings|launchPackage).*opened|opened the android settings|launched com\.android\.settings/i.test(
        fact,
      ),
    )
  ) {
    return true;
  }
  const text = (visibleText ?? []).join("\n").toLowerCase();
  return (
    screenKind === "settings_app" &&
    (text.includes("settings") ||
      text.includes("network") ||
      text.includes("display") ||
      text.includes("apps") ||
      text.includes("system"))
  );
};
