import { readFileSync } from "node:fs";
import { z } from "zod";

const environmentSchema = z.object({
  FIREWALL_AGENT_SOCKET: z.string().min(1).optional(),
  FIREWALL_AGENT_STATE_PATH: z.string().min(1).optional(),
  FIREWALL_AGENT_SHARED_SECRET: z.string().optional(),
  FIREWALL_AGENT_SHARED_SECRET_FILE: z.string().min(1).optional(),
  FIREWALL_ADAPTER: z.string().min(1).optional(),
});

export function createFirewallAgentConfig(
  env: NodeJS.ProcessEnv = process.env,
) {
  const environment = environmentSchema.parse(env);
  const secretFile =
    environment.FIREWALL_AGENT_SHARED_SECRET_FILE ??
    "/app/secrets/rebroid-shared-secret";
  let secret = environment.FIREWALL_AGENT_SHARED_SECRET?.trim() ?? "";

  return {
    socketPath:
      environment.FIREWALL_AGENT_SOCKET ?? "/run/rebroid-firewall/agent.sock",
    statePath:
      environment.FIREWALL_AGENT_STATE_PATH ??
      "/run/rebroid-firewall/policies.json",
    getSecret() {
      if (secret) return secret;
      try {
        secret = readFileSync(secretFile, "utf8").trim();
      } catch {
        // The orchestrator can create the shared secret after the agent starts.
      }
      return secret;
    },
    adapter: environment.FIREWALL_ADAPTER,
  };
}
