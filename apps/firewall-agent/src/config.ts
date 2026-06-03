import { existsSync, readFileSync } from "node:fs";
import { z } from "zod";

const environment = z
  .object({
    FIREWALL_AGENT_SOCKET: z.string().min(1).optional(),
    FIREWALL_AGENT_STATE_PATH: z.string().min(1).optional(),
    FIREWALL_AGENT_SHARED_SECRET: z.string().min(1).optional(),
    FIREWALL_AGENT_SHARED_SECRET_FILE: z.string().min(1).optional(),
    FIREWALL_ADAPTER: z
      .enum(["auto", "docker-iptables", "podman-iptables", "nftables"])
      .optional(),
  })
  .parse(process.env);

const secretFile =
  environment.FIREWALL_AGENT_SHARED_SECRET_FILE ??
  "/app/secrets/rebroid-shared-secret";

export const firewallAgentConfig = {
  socketPath:
    environment.FIREWALL_AGENT_SOCKET ?? "/run/rebroid-firewall/agent.sock",
  statePath:
    environment.FIREWALL_AGENT_STATE_PATH ??
    "/run/rebroid-firewall/policies.json",
  secret:
    environment.FIREWALL_AGENT_SHARED_SECRET?.trim() ||
    (existsSync(secretFile) ? readFileSync(secretFile, "utf8").trim() : ""),
  adapter: environment.FIREWALL_ADAPTER,
};

if (!firewallAgentConfig.secret) {
  throw new Error(
    "Firewall agent shared secret is required. Configure FIREWALL_AGENT_SHARED_SECRET or FIREWALL_AGENT_SHARED_SECRET_FILE.",
  );
}
