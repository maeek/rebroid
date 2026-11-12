import {
  isDefaultAiCapability,
  isRoutedAiCapability,
} from '@rebroid/automation-core/ai-run';
import type { AutomationAiRunInput } from '../../settings/contracts/ai-provider';
import type { AutomationCommandDto } from '../dto/automation-command.dto';

export type RoutedAiCapabilities = readonly AutomationCommandDto[];

export const routeCapabilities = ({
  commands,
  goal,
  input,
}: {
  commands: AutomationCommandDto[];
  goal: string;
  input: Pick<AutomationAiRunInput, 'capabilities'>;
}): RoutedAiCapabilities => {
  const terms = new Set(
    goal
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((term) => term.length >= 3),
  );
  return commands
    .filter(
      (command) =>
        isRoutedAiCapability(command.uses) &&
        commandAllowedForRun(input, command.uses),
    )
    .map((command) => ({
      command,
      score: scoreCapability(command, terms),
    }))
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.command.uses.localeCompare(right.command.uses),
    )
    .slice(0, 5)
    .map(({ command }) => command);
};

export const capabilityPrompt = (capabilities: RoutedAiCapabilities) => {
  if (capabilities.length === 0) return 'Available capabilities: none.';
  return [
    'Available typed capabilities for invoke_capability:',
    ...capabilities.map(
      (capability) =>
        `- ${capability.uses}: ${capability.description}; input=${JSON.stringify(capability.inputSchema)}`,
    ),
  ].join('\n');
};

export const commandAllowedForRun = (
  input: Pick<AutomationAiRunInput, 'capabilities'>,
  uses: string,
) => input.capabilities?.includes(uses) ?? isDefaultAiCapability(uses);

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
    isDefaultAiCapability(command.uses) ? 0.25 : 0,
  );
};
