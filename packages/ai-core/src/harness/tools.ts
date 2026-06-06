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
    .map((command) => ({
      type: "function" as const,
      function: {
        name: toolName(command.uses),
        description: `${command.label}. ${command.description}`,
        parameters: command.inputSchema,
      },
    }));

export const mapUsesByToolName = (
  commands: Pick<AutomationCommandLike, "uses">[],
) => new Map(commands.map((command) => [toolName(command.uses), command.uses]));
