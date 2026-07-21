import { createHash } from 'node:crypto';
import type { DeviceAgentAction } from './core/device-decision';
import type { AutomationAiRunInput } from '../../settings/contracts/ai-provider';
import type { AutomationCommandDto } from '../dto/automation-command.dto';
import type { AutomationAiHarnessContext } from './automation-ai.types';
import type { AutomationScreenObservation } from '../vision/automation-vision.types';

export interface DeviceAgentSubgoal {
  id: string;
  goal: string;
  successEvidence: string;
  status: 'pending' | 'completed';
}

export interface DeviceAgentEvidence {
  id: string;
  kind: 'snapshot' | 'action' | 'typed-result';
  summary: string;
  snapshotId?: string;
  data?: Record<string, unknown>;
}

export interface DeviceAgentTrajectoryEntry {
  action: string;
  outcome: string;
  evidenceId: string;
  snapshotId?: string;
  failed: boolean;
}

export interface DeviceTargetSession {
  id: string;
  fingerprint: string;
  applicationId: string;
  containerId: string | null;
  containerName: string;
  networkName: string;
  adbPort: number;
}

export interface DeviceAgentState {
  target: DeviceTargetSession;
  observation: AutomationScreenObservation;
  plannerText: string;
  subgoals: DeviceAgentSubgoal[];
  evidence: DeviceAgentEvidence[];
  trajectory: DeviceAgentTrajectoryEntry[];
  actions: number;
  consecutiveFailures: number;
  planAttempts: number;
}

const fixedActionUses = new Set([
  'android.tapNormalized',
  'android.swipeNormalized',
  'android.inputText',
  'android.key',
  'android.launchPackage',
  'android.openSystemSettings',
  'android.expandNotifications',
  'android.expandQuickSettings',
  'android.viewerCommand',
  'android.wait',
]);

const safeDefaultCapabilities = new Set([
  'android.listPackages',
  'android.getSetting',
  'android.getClipboard',
]);

const safeDefaultTools = new Set([
  ...fixedActionUses,
  ...safeDefaultCapabilities,
]);

export const createTargetSession = (
  context: AutomationAiHarnessContext,
): DeviceTargetSession => {
  const identity = [
    context.app.id,
    context.app.containerId ?? 'no-container',
    context.app.containerName,
    context.app.networkName,
    context.app.adbPort,
  ].join('|');
  const fingerprint = createHash('sha256')
    .update(identity)
    .digest('hex')
    .slice(0, 16);
  return {
    id: `target-${fingerprint}`,
    fingerprint,
    applicationId: context.app.id,
    containerId: context.app.containerId,
    containerName: context.app.containerName,
    networkName: context.app.networkName,
    adbPort: context.app.adbPort,
  };
};

export const assertTargetSession = (
  expected: DeviceTargetSession,
  context: AutomationAiHarnessContext,
) => {
  const current = createTargetSession(context);
  if (current.fingerprint !== expected.fingerprint) {
    throw new Error(
      `Automation target changed from ${expected.fingerprint} to ${current.fingerprint}; a fresh observation is required.`,
    );
  }
};

export const routeCapabilities = ({
  commands,
  goal,
  input,
}: {
  commands: AutomationCommandDto[];
  goal: string;
  input: Pick<AutomationAiRunInput, 'allowedTools' | 'capabilities'>;
}) => {
  const configured = input.capabilities ?? input.allowedTools;
  const allowed = configured ? new Set(configured) : safeDefaultCapabilities;
  const terms = new Set(
    goal
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((term) => term.length >= 3),
  );
  return commands
    .filter((command) => command.uses !== 'ai.run')
    .filter((command) => command.uses !== 'android.adbShell')
    .filter((command) => !fixedActionUses.has(command.uses))
    .filter((command) => allowed.has(command.uses))
    .map((command) => ({
      ...command,
      score: scoreCapability(command, terms),
    }))
    .sort(
      (left, right) =>
        right.score - left.score || left.uses.localeCompare(right.uses),
    )
    .slice(0, 5);
};

export const capabilityPrompt = (
  capabilities: ReturnType<typeof routeCapabilities>,
) => {
  if (capabilities.length === 0) return 'Available capabilities: none.';
  return [
    'Available typed capabilities for invoke_capability:',
    ...capabilities.map(
      (capability) =>
        `- ${capability.uses}: ${capability.description}; input=${JSON.stringify(capability.inputSchema)}`,
    ),
  ].join('\n');
};

export const toolAllowedForRun = (
  input: Pick<AutomationAiRunInput, 'allowedTools' | 'capabilities'>,
  uses: string,
) => {
  const configured = input.capabilities ?? input.allowedTools;
  return configured ? configured.includes(uses) : safeDefaultTools.has(uses);
};

export const resolveActionTool = ({
  action,
  observation,
}: {
  action: DeviceAgentAction;
  observation: AutomationScreenObservation;
}): {
  uses: string;
  input: Record<string, unknown>;
  screenMutating: boolean;
} => {
  if (action.type === 'tap') {
    const point = action.candidateId
      ? candidateCenter(observation, action.candidateId)
      : action.point;
    if (!point) throw new Error('Tap target is missing or stale.');
    return {
      uses: 'android.tapNormalized',
      input: point,
      screenMutating: true,
    };
  }
  if (action.type === 'swipe') {
    return {
      uses: 'android.swipeNormalized',
      input: {
        start: action.start,
        end: action.end,
        durationMs: action.durationMs ?? 300,
      },
      screenMutating: true,
    };
  }
  if (action.type === 'input_text') {
    return {
      uses: 'android.inputText',
      input: { text: action.text },
      screenMutating: true,
    };
  }
  if (action.type === 'key') {
    return {
      uses: 'android.key',
      input: { key: action.key },
      screenMutating: true,
    };
  }
  if (action.type === 'launch_app') {
    return {
      uses: 'android.launchPackage',
      input: { packageName: action.packageName },
      screenMutating: true,
    };
  }
  if (action.type === 'open_system_surface') {
    if (action.surface === 'settings') {
      return {
        uses: 'android.openSystemSettings',
        input: {},
        screenMutating: true,
      };
    }
    if (action.surface === 'notifications') {
      return {
        uses: 'android.expandNotifications',
        input: {},
        screenMutating: true,
      };
    }
    if (action.surface === 'quick_settings') {
      return {
        uses: 'android.expandQuickSettings',
        input: {},
        screenMutating: true,
      };
    }
    return {
      uses: 'android.viewerCommand',
      input: { command: 'home' },
      screenMutating: true,
    };
  }
  if (action.type === 'wait') {
    return {
      uses: 'android.wait',
      input: { durationMs: action.durationMs },
      screenMutating: true,
    };
  }
  return {
    uses: action.uses,
    input: action.input,
    screenMutating: false,
  };
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

export const shouldPlanInitially = (
  mode: AutomationAiRunInput['agentMode'],
  prompt: string,
) => {
  if (mode === 'planned') return true;
  if (mode === 'controller') return false;
  const normalized = prompt.toLowerCase();
  return (
    /\bthen\b|\bafter that\b|\bfinally\b/.test(normalized) ||
    prompt.split(/\r?\n/).filter((line) => /^\s*(?:[-*]|\d+[.)])\s+/.test(line))
      .length >= 2
  );
};

export const validatedEscalationCommand = (program: string, args: string[]) => {
  const safeToken = /^[a-zA-Z0-9._:/=-]+$/;
  if (!safeToken.test(program) || args.some((arg) => !safeToken.test(arg))) {
    return null;
  }
  if (program === 'settings' && args[0] === 'get' && args.length === 3) {
    return [program, ...args].join(' ');
  }
  if (program === 'getprop' && args.length <= 1) {
    return [program, ...args].join(' ');
  }
  if (program === 'dumpsys' && args.length === 1) {
    return [program, ...args].join(' ');
  }
  return null;
};

const scoreCapability = (command: AutomationCommandDto, terms: Set<string>) => {
  const haystack =
    `${command.uses} ${command.label} ${command.description}`.toLowerCase();
  return [...terms].reduce(
    (score, term) => score + (haystack.includes(term) ? 1 : 0),
    safeDefaultCapabilities.has(command.uses) ? 0.25 : 0,
  );
};

const candidateCenter = (
  observation: AutomationScreenObservation,
  candidateId: string,
) => {
  const candidate = observation.candidates.find(
    (item) => item.id === candidateId,
  );
  if (!candidate?.bounds) return null;
  return {
    x: clamp(candidate.bounds.left + candidate.bounds.width / 2),
    y: clamp(candidate.bounds.top + candidate.bounds.height / 2),
  };
};

const clamp = (value: number) => Math.max(0, Math.min(1, value));
