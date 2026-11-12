import { sanitizeAiText } from '../ai/automation-ai-observation.utils';
import { correctScreenStateHypothesis } from '../ai/core/screen-state-policy';
import type { AutomationVisionScreenState } from './automation-vision.types';
import type { NormalizedBox } from './vision-geometry';

interface VisionLocateModelMatch {
  label: string;
  description?: string;
  confidence: number;
  bounds: NormalizedBox;
}

const screenKinds = new Set([
  'home',
  'app_drawer',
  'quick_settings',
  'notification_shade',
  'settings_app',
  'app_screen',
  'unknown',
]);

export const parseVisionScreenStateResponse = (
  text: string,
): AutomationVisionScreenState => {
  const parsed = parseJsonObject(extractJsonObject(text));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      screenKind: 'unknown',
      confidence: 0.25,
      visibleText: [],
      controls: [],
      evidence: [],
      uncertainty: ['Vision model did not return structured JSON.'],
      summary: sanitizeAiText(text || 'Vision model returned no summary.', 800),
    };
  }
  const record = parsed as Record<string, unknown>;
  const requestedKind =
    typeof record.screenKind === 'string' ? record.screenKind : 'unknown';
  const rawScreenKind = screenKinds.has(requestedKind)
    ? (requestedKind as AutomationVisionScreenState['screenKind'])
    : 'unknown';
  const rawSummary =
    typeof record.summary === 'string'
      ? sanitizeAiText(record.summary, 800)
      : sanitizeAiText(text, 800);
  const baseState: AutomationVisionScreenState = {
    screenKind: rawScreenKind,
    confidence: clamp01(Number(record.confidence)),
    visibleText: stringArray(record.visibleText, 30, 120),
    controls: (Array.isArray(record.controls) ? record.controls : []).flatMap(
      normalizeVisionControl,
    ),
    evidence: stringArray(record.evidence, 12, 180),
    uncertainty: stringArray(record.uncertainty, 12, 180),
    summary: rawSummary,
  };
  const correction = correctScreenStateHypothesis(baseState);
  return {
    ...baseState,
    controls: withSettingsAccessControl(
      baseState.controls,
      correction.settingsAccessVisible,
    ),
    screenKind: correction.screenKind,
    confidence: correction.confidence,
    settingsAccessVisible: correction.settingsAccessVisible,
    ...(correction.screenKind !== rawScreenKind
      ? {
          rawScreenKind,
          rawSummary,
          correctionReason: correction.correctionReason,
          uncertainty: [
            ...baseState.uncertainty,
            correction.correctionReason ??
              'Screen kind was corrected by deterministic policy.',
          ].slice(0, 12),
        }
      : {}),
  };
};

const withSettingsAccessControl = (
  controls: AutomationVisionScreenState['controls'],
  settingsAccessVisible: boolean,
) => {
  if (!settingsAccessVisible) return controls;
  if (
    controls.some((control) =>
      /\b(settings?|gear|cog|settings access)\b/i.test(control.label),
    )
  ) {
    return controls;
  }
  return [
    {
      label: 'Settings access candidate',
      role: 'icon',
      confidence: 0.5,
      evidence: ['Screen-state evidence mentions settings or gear access.'],
    },
    ...controls,
  ].slice(0, 30);
};

const normalizeVisionControl = (
  value: unknown,
): AutomationVisionScreenState['controls'] => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  const record = value as Record<string, unknown>;
  const label =
    typeof record.label === 'string' ? sanitizeAiText(record.label, 120) : '';
  if (!label) return [];
  const bounds = parseModelBounds(record.bounds);
  const confidence = Number(record.confidence);
  return [
    {
      label,
      ...(typeof record.role === 'string'
        ? { role: sanitizeAiText(record.role, 40) }
        : {}),
      ...(bounds && bounds.left >= 0 && bounds.top >= 0 ? { bounds } : {}),
      ...(Number.isFinite(confidence)
        ? { confidence: clamp01(confidence) }
        : {}),
      ...(Array.isArray(record.evidence)
        ? { evidence: stringArray(record.evidence, 4, 120) }
        : {}),
    },
  ];
};

export const parseVisionLocateResponse = (text: string) => {
  const parsed = parseJsonObject(extractJsonObject(text));
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !('matches' in parsed) ||
    !Array.isArray(parsed.matches)
  ) {
    throw new Error('Vision model returned an invalid locate response.');
  }
  const record = parsed as Record<string, unknown>;
  const matches = parsed.matches;
  return {
    matches: matches.flatMap((match): VisionLocateModelMatch[] => {
      if (!match || typeof match !== 'object') return [];
      const item = match as Record<string, unknown>;
      const bounds = parseModelBounds(item.bounds);
      const confidence = Number(item.confidence);
      if (!bounds || !Number.isFinite(confidence)) return [];
      return [
        {
          label:
            typeof item.label === 'string'
              ? sanitizeAiText(item.label, 120)
              : 'Visual match',
          description:
            typeof item.description === 'string'
              ? sanitizeAiText(item.description, 240)
              : undefined,
          confidence,
          bounds,
        },
      ];
    }),
    ...(typeof record.reason === 'string'
      ? { reason: sanitizeAiText(record.reason, 500) }
      : {}),
  };
};

const parseModelBounds = (value: unknown): NormalizedBox | undefined => {
  if (!value || typeof value !== 'object') return;
  const record = value as Record<string, unknown>;
  const left = Number(record.left);
  const top = Number(record.top);
  const width = Number(record.width);
  const height = Number(record.height);
  if (![left, top, width, height].every(Number.isFinite)) return;
  if (width <= 0 || height <= 0) return;
  return { left, top, width, height };
};

const stringArray = (value: unknown, maxItems: number, maxLength: number) =>
  (Array.isArray(value) ? value : [])
    .filter((item): item is string => typeof item === 'string')
    .slice(0, maxItems)
    .map((item) => sanitizeAiText(item, maxLength));

const clamp01 = (value: number) =>
  Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;

const extractJsonObject = (text: string) => {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  return start >= 0 && end > start ? trimmed.slice(start, end + 1) : trimmed;
};

const parseJsonObject = (text: string) => {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
};
