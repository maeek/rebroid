import { createHash } from 'node:crypto';
import type { DeviceAgentAction } from './core/device-decision';
import type { AutomationScreenObservation } from '../vision/automation-vision.types';

const SCREEN_MUTATING_COMMANDS = new Set([
  'android.adbShell',
  'android.inputText',
  'android.key',
  'android.rotateDisplay',
  'android.setClipboard',
  'android.collapsePanels',
  'android.expandNotifications',
  'android.expandQuickSettings',
  'android.launchPackage',
  'android.swipe',
  'android.swipeNormalized',
  'android.tap',
  'android.tapNormalized',
  'android.viewerCommand',
]);

export interface ResolvedAiAction {
  uses: string;
  input: Record<string, unknown>;
  screenMutating: boolean;
}

const screenAction = (
  uses: string,
  input: Record<string, unknown> = {},
): ResolvedAiAction => ({ uses, input, screenMutating: true });

const systemSurfaceCommands = {
  settings: 'android.openSystemSettings',
  notifications: 'android.expandNotifications',
  quick_settings: 'android.expandQuickSettings',
} as const;

export const resolveActionCommand = (
  action: DeviceAgentAction,
  observation: Pick<AutomationScreenObservation, 'candidates'>,
): ResolvedAiAction | null => {
  switch (action.type) {
    case 'tap': {
      const point = action.candidateId
        ? candidateCenter(observation.candidates, action.candidateId)
        : action.point;
      return point ? screenAction('android.tapNormalized', point) : null;
    }
    case 'swipe':
      return screenAction('android.swipeNormalized', {
        start: action.start,
        end: action.end,
        durationMs: action.durationMs ?? 300,
      });
    case 'input_text':
      return screenAction('android.inputText', { text: action.text });
    case 'key':
      return screenAction('android.key', { key: action.key });
    case 'launch_app':
      return screenAction('android.launchPackage', {
        packageName: action.packageName,
      });
    case 'open_system_surface':
      if (action.surface === 'home') {
        return screenAction('android.viewerCommand', { command: 'home' });
      }
      return screenAction(systemSurfaceCommands[action.surface]);
    case 'wait':
      return screenAction('android.wait', { durationMs: action.durationMs });
    case 'invoke_capability':
      return {
        uses: action.uses,
        input: action.input,
        screenMutating: SCREEN_MUTATING_COMMANDS.has(action.uses),
      };
  }
};

export const resultIndicatesFailure = (data: Record<string, unknown>) => {
  if (data.failed === true || data.success === false) return true;
  if (typeof data.exitCode === 'number' && data.exitCode !== 0) return true;
  for (const key of ['executed', 'opened', 'launched', 'found']) {
    if (data[key] === false) return true;
  }
  return typeof data.failureCategory === 'string';
};

export const screenFingerprint = (observation: AutomationScreenObservation) =>
  createHash('sha256')
    .update(
      observation.markedImage?.dataUrl ?? observation.aiImage?.dataUrl ?? '',
    )
    .digest('hex')
    .slice(0, 16);

const candidateCenter = (
  candidates: AutomationScreenObservation['candidates'],
  candidateId: string,
) => {
  const candidate = candidates.find((item) => item.id === candidateId);
  if (!candidate?.bounds) return null;
  return {
    x: clamp(candidate.bounds.left + candidate.bounds.width / 2),
    y: clamp(candidate.bounds.top + candidate.bounds.height / 2),
  };
};

const clamp = (value: number) => Math.max(0, Math.min(1, value));
