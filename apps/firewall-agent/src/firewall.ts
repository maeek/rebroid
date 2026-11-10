import { execFileSync } from "node:child_process";
import {
  firewallChainName,
  validatePolicies,
  validatePolicy,
  type FirewallPolicy,
} from "@rebroid/firewall-policy-core/policy";

const ROOT_CHAIN = "REBROID_FW";
const LEGACY_ROOT_CHAIN = "REBROID_FW_NEXT";
const OWNED_APP_CHAIN =
  /^-N ((?:RB_APP_|REBROID_APP_)[A-Z0-9]{1,16}(?:_NEXT)?)$/;
const IPTABLES_LOCK_WAIT = "5";
const NFT_TABLE = "rebroid_fw";

const startupFirst = (policies: Map<string, FirewallPolicy>) =>
  [...policies.values()].sort(
    (a, b) => Number(Boolean(b.startup)) - Number(Boolean(a.startup)),
  );

export interface FirewallAdapter {
  name: string;
  initialize(): void;
  apply(policy: FirewallPolicy, policies: Map<string, FirewallPolicy>): void;
  remove(applicationId: string, policies: Map<string, FirewallPolicy>): void;
  reconcile(policies: Map<string, FirewallPolicy>): void;
}

export interface FirewallCommandRunner {
  run(
    binary: string,
    args: string[],
    options?: { ignoreFailure?: boolean; input?: string },
  ): { ok: boolean; output: string };
}

export class ExecFileFirewallCommandRunner implements FirewallCommandRunner {
  run(
    binary: string,
    args: string[],
    options: { ignoreFailure?: boolean; input?: string } = {},
  ) {
    try {
      return {
        ok: true,
        output: execFileSync(binary, args, {
          encoding: "utf8",
          input: options.input,
          stdio: ["pipe", "pipe", "pipe"],
        }),
      };
    } catch (error) {
      if (options.ignoreFailure) return { ok: false, output: "" };
      throw error;
    }
  }
}

const defaultCommandRunner = new ExecFileFirewallCommandRunner();

export const chainName = firewallChainName;
export { validatePolicies, validatePolicy, type FirewallPolicy };

export class IptablesAdapter implements FirewallAdapter {
  readonly name: string;

  constructor(
    private readonly anchor: "DOCKER-USER" | "FORWARD",
    private readonly runner: FirewallCommandRunner = defaultCommandRunner,
  ) {
    this.name =
      anchor === "DOCKER-USER" ? "docker-iptables" : "podman-iptables";
  }

  initialize() {}

  apply(_policy: FirewallPolicy, policies: Map<string, FirewallPolicy>) {
    this.reconcile(policies);
  }

  remove(_applicationId: string, policies: Map<string, FirewallPolicy>) {
    this.reconcile(policies);
  }

  reconcile(policies: Map<string, FirewallPolicy>) {
    const listing = this.runner.run("iptables", [
      "--wait",
      IPTABLES_LOCK_WAIT,
      "-S",
    ]);
    if (!listing.ok)
      throw new Error("Could not read the iptables filter table.");

    const rules = listing.output.split("\n");
    const anchorRule = `-A ${this.anchor} -j ${ROOT_CHAIN}`;
    const legacyAnchorRule = `-A ${this.anchor} -j ${LEGACY_ROOT_CHAIN}`;
    const activeChains = new Set([ROOT_CHAIN]);
    const declarations = [`:${ROOT_CHAIN} - [0:0]`];
    const updates: string[] = [];
    for (const policy of startupFirst(policies)) {
      if (!policy.enabled) continue;
      const chain = chainName(policy.applicationId);
      if (activeChains.has(chain)) {
        throw new Error(`Firewall policies share the iptables chain ${chain}.`);
      }
      activeChains.add(chain);
      declarations.push(`:${chain} - [0:0]`);
      for (const cidr of policy.allowCidrs) {
        updates.push(`-A ${chain} -d ${cidr} -j ACCEPT`);
      }
      updates.push(
        `-A ${chain} -j REJECT`,
        `-A ${ROOT_CHAIN} -s ${policy.containerIp} -j ${chain}`,
      );
    }

    for (const rule of rules) {
      if (rule === anchorRule || rule === legacyAnchorRule) {
        updates.push(`-D ${rule.slice(3)}`);
      }
    }
    updates.push(`-I ${this.anchor} 1 -j ${ROOT_CHAIN}`);
    if (!this.restore([...declarations, ...updates]).ok) {
      throw new Error("Could not commit the iptables firewall rules.");
    }

    // Retire obsolete chains only after the new forwarding path is committed.
    // If any chain is still referenced, deletion fails and this batch is discarded.
    const staleChains = rules
      .map((rule) =>
        rule === `-N ${LEGACY_ROOT_CHAIN}`
          ? LEGACY_ROOT_CHAIN
          : OWNED_APP_CHAIN.exec(rule)?.[1],
      )
      .filter(
        (chain): chain is string =>
          chain !== undefined && !activeChains.has(chain),
      );
    if (staleChains.length) {
      this.restore(
        [
          ...staleChains.map((chain) => `-F ${chain}`),
          ...staleChains.map((chain) => `-X ${chain}`),
        ],
        true,
      );
    }
  }

  private restore(rules: string[], ignoreFailure = false) {
    return this.runner.run(
      "iptables-restore",
      ["--noflush", "--wait", IPTABLES_LOCK_WAIT],
      {
        ignoreFailure,
        input: ["*filter", ...rules, "COMMIT", ""].join("\n"),
      },
    );
  }
}

export class NftablesAdapter implements FirewallAdapter {
  readonly name = "nftables";

  constructor(
    private readonly runner: FirewallCommandRunner = defaultCommandRunner,
  ) {}

  initialize() {}

  apply(_policy: FirewallPolicy, policies: Map<string, FirewallPolicy>) {
    this.reconcile(policies);
  }

  remove(_applicationId: string, policies: Map<string, FirewallPolicy>) {
    this.reconcile(policies);
  }

  reconcile(policies: Map<string, FirewallPolicy>) {
    const lines = [
      `table inet ${NFT_TABLE} {`,
      " chain forward {",
      "  type filter hook forward priority -1; policy accept;",
    ];
    for (const policy of startupFirst(policies)) {
      if (!policy.enabled) continue;
      if (policy.allowCidrs.length) {
        lines.push(
          `  ip saddr ${policy.containerIp} ip daddr { ${policy.allowCidrs.join(", ")} } accept`,
        );
      }
      lines.push(`  ip saddr ${policy.containerIp} reject`);
    }
    lines.push(" }", "}");
    const exists = this.runner.run(
      "nft",
      ["list", "table", "inet", NFT_TABLE],
      {
        ignoreFailure: true,
      },
    ).ok;
    this.runner.run("nft", ["-f", "-"], {
      input: `${exists ? `delete table inet ${NFT_TABLE}\n` : ""}${lines.join("\n")}\n`,
    });
  }
}

export const detectAdapter = (
  requested = "auto",
  runner: FirewallCommandRunner = defaultCommandRunner,
): FirewallAdapter => {
  if (requested === "docker-iptables")
    return new IptablesAdapter("DOCKER-USER", runner);
  if (requested === "podman-iptables")
    return new IptablesAdapter("FORWARD", runner);
  if (requested === "nftables") return new NftablesAdapter(runner);
  if (requested !== "auto")
    throw new Error(`Unsupported firewall adapter: ${requested}`);
  if (runner.run("iptables", ["-S", "DOCKER-USER"], { ignoreFailure: true }).ok)
    return new IptablesAdapter("DOCKER-USER", runner);
  if (runner.run("nft", ["list", "tables"], { ignoreFailure: true }).ok)
    return new NftablesAdapter(runner);
  if (runner.run("iptables", ["-S", "FORWARD"], { ignoreFailure: true }).ok)
    return new IptablesAdapter("FORWARD", runner);
  throw new Error("No supported host firewall backend was detected.");
};
