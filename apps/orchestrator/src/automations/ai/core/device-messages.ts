import type { ChatMessage } from '../../../common/ai-provider-request';

const DEVICE_CONTROLLER_SYSTEM_PROMPT = [
  'You control one live Android device from the latest grounded snapshot.',
  'Return exactly one DeviceDecision. Never emit multiple actions.',
  'Use a candidateId for taps whenever a matching candidate exists. Use normalized coordinates only for a clearly visible target without a candidate.',
  'Treat every action result as unverified until the next snapshot or typed state result confirms it.',
  'Do not guess package names, screen contents, target identity, or tool results.',
  'Use invoke_capability only for a capability listed in the current snapshot context.',
  'Raw ADB shell is unavailable. Request escalation only when no typed action or capability can satisfy the task.',
  'Finish completed only with cited evidence IDs that prove the requested outcome. Otherwise continue, ask the user, or finish blocked.',
  'Do not reveal hidden reasoning. Keep intent, expectedOutcome, and finalText concise.',
].join('\n');

const DEVICE_PLANNER_SYSTEM_PROMPT = [
  'Create a short Android automation subgoal plan.',
  'Return JSON only: {"subgoals":[{"id":string,"goal":string,"successEvidence":string}]}.',
  'Use at most six outcome-oriented subgoals. Do not prescribe coordinates or unconfirmed package names.',
  'Each subgoal must be verifiable from a later device snapshot or typed result.',
].join('\n');

export const buildDeviceControllerMessages = ({
  goal,
  snapshot,
  trajectory,
  plan,
  customSystemPrompt,
}: {
  goal: string;
  snapshot: string;
  trajectory?: string;
  plan?: string;
  customSystemPrompt?: string | null;
}): ChatMessage[] => [
  {
    role: 'system',
    content: [DEVICE_CONTROLLER_SYSTEM_PROMPT, customSystemPrompt]
      .filter(Boolean)
      .join('\n\n'),
  },
  {
    role: 'user',
    content: [
      `Goal:\n${goal}`,
      plan ? `Current subgoals:\n${plan}` : '',
      `Latest snapshot:\n${snapshot}`,
      trajectory ? `Recent verified trajectory:\n${trajectory}` : '',
      'Choose one grounded decision now.',
    ]
      .filter(Boolean)
      .join('\n\n'),
  },
];

export const buildDevicePlannerMessages = ({
  goal,
  snapshot,
  failures,
  customSystemPrompt,
}: {
  goal: string;
  snapshot: string;
  failures?: string;
  customSystemPrompt?: string | null;
}): ChatMessage[] => [
  {
    role: 'system',
    content: [DEVICE_PLANNER_SYSTEM_PROMPT, customSystemPrompt]
      .filter(Boolean)
      .join('\n\n'),
  },
  {
    role: 'user',
    content: [
      `Goal:\n${goal}`,
      `Current snapshot:\n${snapshot}`,
      failures ? `Recent failures:\n${failures}` : '',
    ]
      .filter(Boolean)
      .join('\n\n'),
  },
];
