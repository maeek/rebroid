import type { AutomationCommandLike } from "./types";

export const toolName = (uses: string) => uses.replace(/[^a-zA-Z0-9_]/g, "__");

export const allowedToolMatcher = (allowedTools?: string[]) => {
  const allowed = new Set((allowedTools ?? []).filter(Boolean));
  return (uses: string) => allowed.size === 0 || allowed.has(uses);
};

export const buildToolDefinitions = (
  commands: AutomationCommandLike[],
  allowed: (uses: string) => boolean,
) =>
  commands
    .filter((command) => command.uses !== "ai.run" && allowed(command.uses))
    .map((command) => {
      const commandInputSchema =
        command.inputSchema && !Array.isArray(command.inputSchema)
          ? command.inputSchema
          : { type: "object", properties: {}, additionalProperties: true };
      return {
        type: "function" as const,
        function: {
          name: toolName(command.uses),
          description: `${command.label}. ${command.description}`,
          parameters: {
            type: "object" as const,
            properties: {
              intent: {
                type: "string",
                description:
                  "Short reason for calling this tool (2-12 words).",
                minLength: 5,
                maxLength: 140,
              },
              expectedOutcome: {
                type: "string",
                description:
                  "The concrete screen or state result you expect if the call succeeds.",
                minLength: 8,
                maxLength: 220,
              },
              input:
                commandInputSchema &&
                typeof commandInputSchema === "object"
                  ? commandInputSchema
                  : { type: "object", properties: {}, additionalProperties: true },
            },
            required: ["intent", "expectedOutcome", "input"],
            additionalProperties: false,
          },
        },
      };
    });

export const mapUsesByToolName = (
  commands: Pick<AutomationCommandLike, "uses">[],
) => new Map(commands.map((command) => [toolName(command.uses), command.uses]));
