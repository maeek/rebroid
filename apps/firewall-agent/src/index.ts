import { chmodSync, mkdirSync, rmSync } from "node:fs";
import { dirname } from "node:path";
import { createFirewallAgentConfig } from "./config";
import { detectAdapter } from "./firewall";
import { FirewallPolicyCommands } from "./policy-commands";
import { FirewallPolicyStore } from "./policy-store";
import { createFirewallAgentServer } from "./server";

const { socketPath, statePath, getSecret, adapter } =
  createFirewallAgentConfig();
const recovery = FirewallPolicyCommands.restore(
  new FirewallPolicyStore(statePath),
  () => detectAdapter(adapter),
);

if (!recovery.commands) {
  const { error } = recovery;
  console.error(
    `[firewall-agent] ${error instanceof Error ? error.message : "Firewall backend is unavailable."}`,
  );
}

const server = createFirewallAgentServer({ getSecret, recovery });

mkdirSync(dirname(socketPath), { recursive: true });
rmSync(socketPath, { force: true });
server.listen(socketPath, () => chmodSync(socketPath, 0o660));
