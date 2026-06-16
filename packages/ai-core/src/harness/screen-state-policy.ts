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
  controls: Array<{
    label: string;
    role?: string;
    confidence?: number;
    evidence?: string[];
    bounds?: {
      left: number;
      top: number;
      width: number;
      height: number;
    };
  }>;
  evidence: string[];
  uncertainty: string[];
  summary: string;
  rawScreenKind?: AiScreenKind;
  settingsAccessVisible?: boolean;
}

export interface AiObservationCandidate {
  id: string;
  label: string;
  source: "ui-xml" | "vision-model" | "screenshot-parser" | "ocr";
  role?: string;
  confidence: number;
  evidence?: string[];
  bounds?: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
}

export interface ScreenStateCorrectionResult {
  screenKind: AiScreenKind;
  confidence: number;
  correctionReason?: string;
  settingsAccessVisible: boolean;
}

export interface ScreenStateReconciliationResult extends ScreenStateCorrectionResult {
  rawScreenKind: AiScreenKind;
  rawConfidence: number;
  contradictionReason?: string;
  visionReliable: boolean;
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
const settingsAccessControlPattern =
  /\b(settings?|gear|cog|system settings|settings access)\b/i;
const strongSettingsAppLandmarks = [
  "network & internet",
  "connected devices",
  "apps",
  "notifications",
  "battery",
  "storage",
  "security",
  "privacy",
  "system",
  "about phone",
];
const homeLandmarks = [
  "launcher",
  "home screen",
  "gallery",
  "camera",
  "contacts",
  "search",
  "app drawer",
];

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
  const settingsAccessVisible =
    state.settingsAccessVisible === true ||
    settingsAccessLandmarks.some((landmark) => haystack.includes(landmark));

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

export const reconcileScreenStateHypothesis = ({
  state,
  candidates = [],
  confirmedFacts = [],
}: {
  state: AiScreenStateHypothesis;
  candidates?: AiObservationCandidate[];
  confirmedFacts?: string[];
}): ScreenStateReconciliationResult => {
  const corrected = correctScreenStateHypothesis(state);
  const rawScreenKind = state.rawScreenKind ?? state.screenKind;
  const candidateHaystack = candidatesHaystack(candidates);
  const stateHaystack = haystackForScreenState(state);
  const combinedHaystack = `${stateHaystack}\n${candidateHaystack}`;
  const quickSettingsMatches = quickSettingsLandmarks.filter((landmark) =>
    combinedHaystack.includes(landmark),
  );
  const homeMatches = homeLandmarks.filter((landmark) =>
    combinedHaystack.includes(landmark),
  );
  const settingsConfirmed =
    hasConfirmedSettingsFact(confirmedFacts) ||
    hasSettingsAppLandmarks(combinedHaystack);

  if (
    corrected.screenKind === "settings_app" &&
    quickSettingsMatches.length >= 2
  ) {
    return {
      ...corrected,
      screenKind: "quick_settings",
      confidence: Math.min(corrected.confidence, 0.45),
      rawScreenKind,
      rawConfidence: state.confidence,
      contradictionReason: `Vision said Settings app, but quick-settings landmarks were detected: ${quickSettingsMatches
        .slice(0, 4)
        .join(", ")}.`,
      correctionReason: `Quick-settings landmarks detected: ${quickSettingsMatches
        .slice(0, 4)
        .join(", ")}.`,
      visionReliable: false,
    };
  }

  if (
    rawScreenKind === "settings_app" &&
    corrected.screenKind === "quick_settings"
  ) {
    return {
      ...corrected,
      rawScreenKind,
      rawConfidence: state.confidence,
      contradictionReason: `Vision said Settings app, but quick-settings landmarks were detected: ${quickSettingsMatches
        .slice(0, 4)
        .join(", ")}.`,
      visionReliable: false,
    };
  }

  if (
    corrected.screenKind === "settings_app" &&
    homeMatches.length >= 2 &&
    !settingsConfirmed
  ) {
    return {
      ...corrected,
      screenKind: "home",
      confidence: Math.min(corrected.confidence, 0.45),
      rawScreenKind,
      rawConfidence: state.confidence,
      contradictionReason: `Vision said Settings app, but launcher/home landmarks were detected: ${homeMatches
        .slice(0, 4)
        .join(", ")}.`,
      correctionReason: `Home-screen landmarks detected: ${homeMatches
        .slice(0, 4)
        .join(", ")}.`,
      visionReliable: false,
    };
  }

  if (corrected.screenKind === "settings_app" && !settingsConfirmed) {
    return {
      ...corrected,
      screenKind: "unknown",
      confidence: Math.min(corrected.confidence, 0.35),
      rawScreenKind,
      rawConfidence: state.confidence,
      contradictionReason:
        "Vision claimed Settings app without confirmed Settings launch facts or strong Settings-app landmarks.",
      correctionReason:
        "Settings-app claim was downgraded because the observation only contained weak or generic settings evidence.",
      visionReliable: false,
    };
  }

  return {
    ...corrected,
    rawScreenKind,
    rawConfidence: state.confidence,
    visionReliable: true,
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

export const rankObservationCandidates = ({
  candidates,
  goal,
  maxCandidates = 12,
}: {
  candidates: AiObservationCandidate[];
  goal?: string;
  maxCandidates?: number;
}) => {
  const goalTerms = (goal ?? "")
    .toLowerCase()
    .split(/\W+/)
    .filter((term) => term.length >= 4);
  return [...candidates]
    .map((candidate) => ({
      candidate,
      score:
        candidate.confidence +
        relevanceBoost(candidate, goalTerms) +
        sourceBoost(candidate.source),
    }))
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return left.candidate.id.localeCompare(right.candidate.id);
    })
    .map(({ candidate }, index) => ({
      ...candidate,
      id: candidate.id || `candidate-${index + 1}`,
    }))
    .slice(0, maxCandidates);
};

export const summarizeObservationCandidates = ({
  candidates,
  goal,
  maxCandidates = 10,
}: {
  candidates: AiObservationCandidate[];
  goal?: string;
  maxCandidates?: number;
}) => {
  const ranked = rankObservationCandidates({
    candidates,
    goal,
    maxCandidates,
  });
  if (ranked.length === 0) return "";
  return [
    "Parsed clickable candidates use numbered IDs. Prefer a candidate ID/center over guessed raw coordinates when it directly advances the goal.",
    ...ranked.map((candidate, index) => {
      const bounds = candidate.bounds
        ? ` center x=${center(candidate.bounds.left, candidate.bounds.width)}, y=${center(candidate.bounds.top, candidate.bounds.height)}`
        : "";
      const evidence =
        candidate.evidence && candidate.evidence.length > 0
          ? ` evidence: ${candidate.evidence.slice(0, 2).join("; ")}`
          : "";
      return `#${index + 1} ${candidate.label}${candidate.role ? ` (${candidate.role})` : ""}${bounds} confidence ${Math.round(candidate.confidence * 100)}% source ${candidate.source}.${evidence}`;
    }),
  ].join("\n");
};

export const summarizeVisualAffordances = ({
  state,
  goal,
  maxControls = 6,
}: {
  state?: AiScreenStateHypothesis | null;
  goal?: string;
  maxControls?: number;
}) => {
  if (!state) return "";
  const goalText = goal?.toLowerCase() ?? "";
  const relevantControls = state.controls
    .filter((control) => {
      if (settingsAccessControlPattern.test(control.label)) return true;
      if (goalText.includes("settings")) {
        return /settings?|gear|cog/i.test(control.label);
      }
      if (!goalText.trim()) return true;
      return goalText
        .split(/\W+/)
        .filter((word) => word.length >= 4)
        .some((word) => control.label.toLowerCase().includes(word));
    })
    .slice(0, maxControls);
  const controls =
    relevantControls.length > 0
      ? relevantControls
      : state.controls.slice(0, Math.min(maxControls, 3));
  const lines = controls.map((control) => {
    const bounds = control.bounds
      ? ` at x=${center(control.bounds.left, control.bounds.width)}, y=${center(control.bounds.top, control.bounds.height)}`
      : "";
    const confidence =
      typeof control.confidence === "number"
        ? `, confidence ${Math.round(control.confidence * 100)}%`
        : "";
    const evidence =
      control.evidence && control.evidence.length > 0
        ? `, evidence: ${control.evidence.slice(0, 2).join("; ")}`
        : "";
    return `- ${control.label}${control.role ? ` (${control.role})` : ""}${bounds}${confidence}${evidence}`;
  });

  if (state.settingsAccessVisible && relevantControls.length === 0) {
    lines.unshift(
      "- Settings access candidate is visible, but the model did not provide reliable bounds.",
    );
  }

  if (lines.length === 0) return "";
  return [
    "Visual affordances are hypotheses, not confirmed facts. Prefer a visible candidate control when it directly advances the goal, then validate with a fresh observation.",
    `Screen hypothesis: ${state.screenKind}, confidence ${Math.round(state.confidence * 100)}%.`,
    ...lines,
  ].join("\n");
};

const hasConfirmedSettingsFact = (confirmedFacts: string[]) =>
  confirmedFacts.some((fact) =>
    /android\.(openSystemSettings|launchPackage).*opened|opened the android settings|launched com\.android\.settings/i.test(
      fact,
    ),
  );

const hasSettingsAppLandmarks = (haystack: string) => {
  const matches = strongSettingsAppLandmarks.filter((landmark) =>
    haystack.includes(landmark),
  );
  return matches.length >= 2;
};

const candidatesHaystack = (candidates: AiObservationCandidate[]) =>
  candidates
    .flatMap((candidate) => [
      candidate.label,
      candidate.role ?? "",
      ...(candidate.evidence ?? []),
    ])
    .join("\n")
    .toLowerCase();

const relevanceBoost = (
  candidate: AiObservationCandidate,
  goalTerms: string[],
) => {
  const label = [
    candidate.label,
    candidate.role ?? "",
    ...(candidate.evidence ?? []),
  ]
    .join(" ")
    .toLowerCase();
  let score = 0;
  if (settingsAccessControlPattern.test(label)) score += 1.2;
  if (goalTerms.some((term) => label.includes(term))) score += 0.35;
  return score;
};

const sourceBoost = (source: AiObservationCandidate["source"]) => {
  if (source === "ui-xml") return 0.25;
  if (source === "ocr") return 0.18;
  if (source === "screenshot-parser") return 0.15;
  return 0;
};

const center = (start: number, size: number) =>
  Math.round((start + size / 2) * 1000) / 1000;
