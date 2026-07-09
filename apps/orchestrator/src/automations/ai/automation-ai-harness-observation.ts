import {
  summarizeVisualAffordances,
  type ScreenObservationPolicySnapshot,
} from '@rebroid/ai-core/harness';
import type { AutomationPerceptionService } from '../vision/automation-perception.service';

export type HarnessObservation = Awaited<
  ReturnType<AutomationPerceptionService['observe']>
>;

const uiEventData = (observation: HarnessObservation) => ({
  uiStatus: observation.observation.uiXml?.status ?? 'unavailable',
  uiNodes: observation.observation.uiXml?.nodeCount ?? null,
  uiDetectionCount:
    observation.observation.uiXml?.detectionCount ??
    observation.observation.detections.length,
  uiRawNodeCount: observation.observation.uiXml?.rawNodeCount ?? null,
  uiDiagnostics: observation.observation.uiXml?.diagnostics ?? null,
  uiError: observation.observation.uiXml?.error ?? null,
});

const ocrEventData = (observation: HarnessObservation) => ({
  ocrStatus: observation.observation.ocr?.status ?? 'unavailable',
  ocrTextCount: observation.observation.ocr?.detections.length ?? 0,
  ocrPreprocessingMode: observation.observation.ocr?.preprocessingMode ?? null,
  ocrPreprocessingAttempts:
    observation.observation.ocr?.preprocessingAttempts ?? [],
  ocrDetections: observation.observation.ocr?.detections.slice(0, 20) ?? [],
});

const screenEventData = (observation: HarnessObservation) => ({
  screenKind: observation.observation.screenState?.screenKind ?? null,
  rawScreenKind: observation.observation.screenState?.rawScreenKind ?? null,
  screenKindCorrectionReason:
    observation.observation.screenState?.correctionReason ?? null,
  settingsAccessVisible:
    observation.observation.screenState?.settingsAccessVisible ?? null,
  visionConfidence: observation.observation.screenState?.confidence ?? null,
  visualControls:
    observation.observation.screenState?.controls.slice(0, 12) ?? [],
});

export const observationEventData = (observation: HarnessObservation) => ({
  width: observation.observation.image.width,
  height: observation.observation.image.height,
  ...uiEventData(observation),
  ...ocrEventData(observation),
  ...screenEventData(observation),
  detections: observation.observation.detections.length,
  hasVisionSummary: Boolean(observation.observation.summary),
  candidates: observation.observation.candidates?.slice(0, 12) ?? [],
  markedScreenshotId: observation.observation.markedScreenshotId ?? null,
  reconciliation: observation.observation.reconciliation ?? null,
  visualAffordances: summarizeVisualAffordances({
    state: observation.observation.screenState ?? null,
  }),
});

const snapshotControls = (observation: HarnessObservation) => {
  if (observation.observation.candidates?.length) {
    return observation.observation.candidates.map((candidate) => ({
      label: candidate.label,
      role: candidate.role,
      confidence: candidate.confidence,
    }));
  }
  return observation.observation.screenState?.controls ?? null;
};

export const observationSnapshot = (
  observation: HarnessObservation,
): ScreenObservationPolicySnapshot => ({
  uiStatus: observation.observation.uiXml?.status ?? 'unavailable',
  uiNodes: observation.observation.uiXml?.nodeCount ?? 0,
  detections: observation.observation.detections.length,
  ocrStatus: observation.observation.ocr?.status ?? 'unavailable',
  ocrText:
    observation.observation.ocr?.detections
      .map((detection) => detection.text ?? detection.label ?? '')
      .filter(Boolean)
      .slice(0, 40) ?? null,
  screenKind: observation.observation.screenState?.screenKind ?? null,
  settingsAccessVisible:
    observation.observation.screenState?.settingsAccessVisible ?? null,
  visibleText: observation.observation.screenState?.visibleText ?? null,
  controls: snapshotControls(observation),
  visionConfidence: observation.observation.screenState?.confidence ?? null,
  visionSummary: observation.observation.summary ?? null,
});

export const isVisionLocateMiss = (
  uses: string,
  input: Record<string, unknown>,
  data: Record<string, unknown> | undefined,
) =>
  uses === 'vision.locate' &&
  data?.found === false &&
  typeof input.query === 'string' &&
  input.query.trim().length > 0;

export const locateMissKey = (input: Record<string, unknown>) =>
  typeof input.query === 'string' ? input.query.trim().toLowerCase() : '';

const launchPackageFact = (
  input: Record<string, unknown>,
  data: Record<string, unknown>,
) => {
  const packageName =
    typeof data.packageName === 'string'
      ? data.packageName
      : typeof input.packageName === 'string'
        ? input.packageName
        : null;
  if (!packageName) return null;
  if (data.launched === true) {
    return `android.launchPackage launched ${packageName}.`;
  }
  if (data.installed === false) {
    return `android.launchPackage confirmed ${packageName} is not installed/launched.`;
  }
  if (data.launched === false) {
    return `android.launchPackage confirmed ${packageName} was not launched.`;
  }
  return null;
};

export const confirmedFactFromToolResult = (
  uses: string,
  input: Record<string, unknown>,
  data: Record<string, unknown>,
) => {
  if (uses === 'android.launchPackage') return launchPackageFact(input, data);
  if (uses === 'android.openSystemSettings') {
    return data.opened === true
      ? 'android.openSystemSettings opened the Android Settings main screen.'
      : 'android.openSystemSettings did not open Android Settings.';
  }
  if (uses === 'android.listPackages') {
    const total = typeof data.total === 'number' ? data.total : null;
    const query =
      typeof data.query === 'string' && data.query.trim()
        ? ` matching "${data.query.trim()}"`
        : '';
    return total === null
      ? 'android.listPackages returned package discovery results.'
      : `android.listPackages found ${total} package(s)${query}.`;
  }
  if (uses === 'android.adbShell') {
    const exitCode = typeof data.exitCode === 'number' ? data.exitCode : null;
    return exitCode === null
      ? 'android.adbShell returned a shell result.'
      : `android.adbShell exited with code ${exitCode}.`;
  }
  return null;
};
