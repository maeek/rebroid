interface AutomationCommandLike {
  uses: string;
  label: string;
  description: string;
  inputSchema: unknown;
  aiTool?: {
    name?: string;
    label?: string;
    description?: string;
  };
}

export const toolName = (uses: string) => uses.replace(/[^a-zA-Z0-9_]/g, '__');

const aiToolName = (command: Pick<AutomationCommandLike, 'uses' | 'aiTool'>) =>
  command.aiTool?.name ? toolName(command.aiTool.name) : toolName(command.uses);

const toolNameAliases = (uses: string) =>
  [
    toolName(uses),
    uses.replace(/[^a-zA-Z0-9_]/g, '_'),
    uses.replace(/[^a-zA-Z0-9_]/g, ''),
  ].filter((name, index, names) => name && names.indexOf(name) === index);

export const allowedToolMatcher = (allowedTools?: string[]) => {
  const allowed = new Set((allowedTools ?? []).filter(Boolean));
  return (uses: string) => allowed.has(uses);
};

export const buildToolDefinitions = (
  commands: AutomationCommandLike[],
  allowed: (uses: string) => boolean,
) =>
  commands
    .filter((command) => command.uses !== 'ai.run' && allowed(command.uses))
    .map((command) => {
      const adbShellCommand = command.uses === 'android.adbShell';
      const commandInputSchema =
        command.inputSchema && !Array.isArray(command.inputSchema)
          ? command.inputSchema
          : { type: 'object', properties: {}, additionalProperties: true };
      return {
        type: 'function' as const,
        function: {
          name: aiToolName(command),
          description: `${command.aiTool?.label ?? command.label}. ${
            command.aiTool?.description ?? command.description
          }`,
          parameters: {
            type: 'object' as const,
            properties: {
              intent: {
                type: 'string',
                description: 'Short reason for calling this tool (2-12 words).',
                minLength: 5,
                maxLength: 140,
              },
              expectedOutcome: {
                type: 'string',
                description:
                  'The concrete screen or state result you expect if the call succeeds.',
                minLength: 8,
                maxLength: 220,
              },
              input:
                commandInputSchema && typeof commandInputSchema === 'object'
                  ? commandInputSchema
                  : {
                      type: 'object',
                      properties: {},
                      additionalProperties: true,
                    },
              ...(adbShellCommand
                ? {
                    requiresScreenObservation: {
                      type: 'boolean',
                      description:
                        'Set to false only for adbShell commands that read state; true otherwise.',
                    },
                  }
                : {}),
            },
            required: ['intent', 'expectedOutcome', 'input'],
            additionalProperties: false,
          },
        },
      };
    });

export const mapUsesByToolName = (
  commands: Pick<AutomationCommandLike, 'uses' | 'aiTool'>[],
) =>
  new Map(
    commands.flatMap((command) => {
      const aliases = [
        aiToolName(command),
        ...toolNameAliases(command.uses),
        ...(command.aiTool?.name ? toolNameAliases(command.aiTool.name) : []),
      ].filter((name, index, names) => name && names.indexOf(name) === index);
      return aliases.map((name) => [name, command.uses]);
    }),
  );
