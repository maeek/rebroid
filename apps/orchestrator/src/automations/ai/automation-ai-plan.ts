import type { AutomationAiRunInput } from '../../settings/contracts/ai-provider';
import type { DeviceAgentSubgoal } from './automation-device-agent-state';

export const devicePlanSchema: Record<string, unknown> = {
  type: 'object',
  properties: {
    subgoals: {
      type: 'array',
      minItems: 1,
      maxItems: 6,
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', minLength: 1, maxLength: 120 },
          goal: { type: 'string', minLength: 1, maxLength: 500 },
          successEvidence: { type: 'string', minLength: 1, maxLength: 500 },
        },
        required: ['id', 'goal', 'successEvidence'],
        additionalProperties: false,
      },
    },
  },
  required: ['subgoals'],
  additionalProperties: false,
};

export const devicePlanTool = {
  type: 'function' as const,
  function: {
    name: 'submit_device_plan',
    description: 'Submit the short, verifiable device automation subgoal plan.',
    parameters: devicePlanSchema,
  },
};

export const parseDevicePlan = (content: string): DeviceAgentSubgoal[] => {
  try {
    const parsed = JSON.parse(content) as { subgoals?: unknown };
    if (!Array.isArray(parsed.subgoals)) return [];
    return parsed.subgoals.slice(0, 6).flatMap((value, index) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return [];
      }
      const subgoal = value as Record<string, unknown>;
      if (
        typeof subgoal.goal !== 'string' ||
        typeof subgoal.successEvidence !== 'string'
      ) {
        return [];
      }
      return [
        {
          id:
            typeof subgoal.id === 'string' && subgoal.id.trim()
              ? subgoal.id.trim().slice(0, 120)
              : `subgoal-${index + 1}`,
          goal: subgoal.goal.trim().slice(0, 500),
          successEvidence: subgoal.successEvidence.trim().slice(0, 500),
          status: 'pending' as const,
        },
      ];
    });
  } catch {
    return [];
  }
};

export const fallbackDevicePlan = (prompt: string): DeviceAgentSubgoal[] => [
  {
    id: 'goal-1',
    goal: prompt.trim().slice(0, 500),
    successEvidence:
      'A fresh device snapshot or typed result confirms the requested outcome.',
    status: 'pending',
  },
];

export const devicePlanText = (subgoals: DeviceAgentSubgoal[]) =>
  subgoals.length === 0
    ? ''
    : subgoals
        .map(
          (subgoal) =>
            `- [${subgoal.status}] ${subgoal.id}: ${subgoal.goal} (evidence: ${subgoal.successEvidence})`,
        )
        .join('\n');

export const conversationGoal = (input: AutomationAiRunInput) => {
  const history = (input.conversation ?? [])
    .slice(-6)
    .map((message) => `${message.role}: ${message.content}`)
    .join('\n');
  return boundedAiText(
    history ? `${history}\nuser: ${input.prompt}` : input.prompt,
    8_000,
  );
};

export const boundedAiText = (value: string, maxLength: number) =>
  value.length <= maxLength
    ? value
    : `${value.slice(0, maxLength)}…[truncated]`;
