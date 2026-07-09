import { chmodSync, mkdirSync, rmSync } from "node:fs";
import { dirname } from "node:path";
import { firewallAgentConfig } from "./config";
import { detectAdapter, FirewallAdapter } from "./firewall";
import { FirewallPolicyStore } from "./policy-store";
import { createFirewallAgentServer } from "./server";

const { socketPath, statePath, secret } = firewallAgentConfig;
const store = new FirewallPolicyStore(statePath);
let adapter: FirewallAdapter | undefined;
let startupError: string | undefined;

const addStartupError = (message: string) => {
  startupError = startupError ? `${startupError} ${message}` : message;
};

if (!secret) {
  addStartupError(
    "Firewall agent shared secret is not configured; policy operations are disabled.",
  );
}

try {
  const policies = store.load();
  adapter = detectAdapter(firewallAgentConfig.adapter);
  adapter.initialize();
  adapter.reconcile(policies);
} catch (error) {
  console.error(
    `[firewall-agent] ${error instanceof Error ? error.message : "Firewall backend is unavailable."}`,
  );
  addStartupError(
    error instanceof Error
      ? `Firewall backend is unavailable: ${error.message}`
      : "Firewall backend is unavailable.",
  );
}

const server = createFirewallAgentServer({
  secret,
  startupError,
  adapter,
  store,
});

mkdirSync(dirname(socketPath), { recursive: true });
rmSync(socketPath, { force: true });
server.listen(socketPath, () => chmodSync(socketPath, 0o660));
