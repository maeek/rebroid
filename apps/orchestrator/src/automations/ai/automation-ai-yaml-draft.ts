import type { ChatMessage } from '../../common/ai-provider-request';
import { parseArguments } from './core/arguments';
import type {
  AutomationDefinition,
  AutomationDefinitionStep,
} from '@rebroid/automation-core/definition';
import { AutomationCommandDto } from '../dto/automation-command.dto';
import { sanitizeAiText } from './automation-ai-observation.utils';
import { textContent } from './automation-ai-message.utils';

const SUBMIT_YAML_TOOL_NAME = 'submitAutomationYaml';
const REQUEST_CLARIFICATION_TOOL_NAME = 'requestDraftClarification';

type DraftClarification = { question: string; answer: string };

export const buildYamlDraftMessages = ({
  prompt,
  commands,
  modelSystemPrompt,
  clarifications,
}: {
  prompt: string;
  commands: AutomationCommandDto[];
  modelSystemPrompt?: string | null;
  clarifications?: DraftClarification[];
}): ChatMessage[] => [
  {
    role: 'system',
    content: [
      'You generate Rebroid Android automation YAML drafts.',
      'Return one complete automation definition by calling submitAutomationYaml.',
      `If one missing detail blocks a runnable draft, ask exactly one concise question by calling ${REQUEST_CLARIFICATION_TOOL_NAME}. Do not ask broad preference questions.`,
      'Use apiVersion rebroid.io/automation/v1 and kind AndroidAutomation.',
      'Use concrete available command steps and control steps; do not use ai.run.',
      'Prefer typed commands over android.adbShell. Prefer normalized coordinates when coordinates are necessary.',
      'If a package name is unknown, do not guess it; draft discovery or checks using available package/text/vision commands instead.',
      'Every action step must use one of the available command uses and satisfy its input schema.',
      'Control steps are available as type: condition, type: switch, and type: repeat.',
      'Condition expressions use groups[].conditions[] with value refs: {source: literal, value}, {source: runContext, key}, or {source: stepOutput, stepId, outputKey}.',
      'Use previous step outputs only when the referenced output key is listed for that command.',
      'Good draft shape: metadata has a short name and description; spec.steps use stable ids; waits/checks have explicit timeouts when supported.',
      'Bad draft shape: guessed package names, ai.run steps, unsupported command uses, raw pixel coordinates, or references to outputs not listed in the command catalog.',
      modelSystemPrompt,
    ]
      .filter(Boolean)
      .join('\n'),
  },
  {
    role: 'user',
    content: [
      `Draft request:\n${prompt.trim()}`,
      '',
      clarificationText(clarifications),
      '',
      'Available commands as JSON:',
      JSON.stringify(commandCatalog(commands)),
      '',
      'Available runContext keys: targetApplicationId, targetProfileMode, targetProfileName, ownerUserId.',
      'Submit only YAML through the submitAutomationYaml tool.',
    ].join('\n'),
  },
];

export const extractSubmittedYaml = (message: ChatMessage) => {
  const toolCall = message.tool_calls?.find(
    (call) => call.function.name === SUBMIT_YAML_TOOL_NAME,
  );
  if (toolCall) {
    const args = parseArguments(toolCall.function.arguments);
    return typeof args.yaml === 'string' && args.yaml.trim()
      ? args.yaml.trim()
      : null;
  }

  const content = textContent(message.content).trim();
  if (!content) return null;
  const fenced = content.match(/```(?:ya?ml)?\s*([\s\S]*?)```/i);
  return (fenced?.[1] ?? content).trim();
};

export const extractDraftClarification = (message: ChatMessage) => {
  const toolCall = message.tool_calls?.find(
    (call) => call.function.name === REQUEST_CLARIFICATION_TOOL_NAME,
  );
  if (!toolCall) return null;
  const args = parseArguments(toolCall.function.arguments);
  return typeof args.question === 'string' && args.question.trim()
    ? sanitizeAiText(args.question, 500)
    : null;
};

export const addYamlRepairFeedback = (
  messages: ChatMessage[],
  message: ChatMessage,
  lastError: string,
) => {
  if (!message.tool_calls?.length) {
    messages.push(yamlRepairMessage(lastError));
    return;
  }
  for (const call of message.tool_calls) {
    messages.push({
      role: 'tool',
      tool_call_id: call.id,
      content:
        call.function.name === SUBMIT_YAML_TOOL_NAME
          ? `Invalid automation YAML: ${lastError}`
          : `Unsupported draft tool call "${call.function.name}". Submit corrected YAML with ${SUBMIT_YAML_TOOL_NAME}.`,
    });
  }
};

export const yamlRepairMessage = (lastError: string): ChatMessage => ({
  role: 'user',
  content: `The submitted automation YAML was invalid: ${lastError}\nSubmit a corrected complete YAML automation using ${SUBMIT_YAML_TOOL_NAME}.`,
});

export const assertDraftUsesAllowedCommands = (
  definition: AutomationDefinition,
  commands: AutomationCommandDto[],
) => {
  const allowed = new Set(commands.map((command) => command.uses));
  const assertStep = (step: AutomationDefinitionStep) => {
    if ('uses' in step) {
      if (step.uses === 'ai.run') {
        throw new Error(
          'Drafted automations must use concrete steps instead of ai.run.',
        );
      }
      if (!allowed.has(step.uses)) {
        throw new Error(
          `Draft uses unavailable automation command "${step.uses}".`,
        );
      }
      return;
    }
    if (step.type === 'condition') {
      step.then.forEach(assertStep);
      step.else?.forEach(assertStep);
      return;
    }
    if (step.type === 'switch') {
      step.cases.forEach((item) => item.steps.forEach(assertStep));
      step.default?.forEach(assertStep);
      return;
    }
    step.steps.forEach(assertStep);
  };
  definition.spec.steps.forEach(assertStep);
};

export const submitYamlTool = () => ({
  type: 'function' as const,
  function: {
    name: SUBMIT_YAML_TOOL_NAME,
    description: 'Submit the final Rebroid automation YAML draft.',
    parameters: {
      type: 'object' as const,
      properties: {
        yaml: {
          type: 'string',
          description:
            'Complete rebroid.io/automation/v1 AndroidAutomation YAML.',
        },
        notes: {
          type: 'string',
          description: 'Brief implementation notes for the draft.',
        },
      },
      required: ['yaml'],
      additionalProperties: false,
    },
  },
});

export const requestClarificationTool = () => ({
  type: 'function' as const,
  function: {
    name: REQUEST_CLARIFICATION_TOOL_NAME,
    description:
      'Ask one concise user-facing question when a missing detail blocks a runnable automation draft.',
    parameters: {
      type: 'object' as const,
      properties: {
        question: {
          type: 'string',
          description:
            'One concise question that the user can answer to continue drafting.',
        },
      },
      required: ['question'],
      additionalProperties: false,
    },
  },
});

const clarificationText = (clarifications?: DraftClarification[]) => {
  const items = (clarifications ?? []).map(
    (item) =>
      `Q: ${sanitizeAiText(item.question, 500)}\nA: ${sanitizeAiText(item.answer, 1000)}`,
  );
  return items.length === 0
    ? 'Clarifications: none.'
    : ['Clarifications already answered:', ...items].join('\n');
};

const commandCatalog = (commands: AutomationCommandDto[]) =>
  commands.map((command) => ({
    uses: command.uses,
    label: command.label,
    description: command.description,
    inputSchema: command.inputSchema,
    inputDefaults: command.editor.inputDefaults,
    outputs: command.outputs.map((output) => ({
      key: output.key,
      type: output.type,
      description: output.description,
    })),
  }));
