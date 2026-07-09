import { execFileSync } from "node:child_process";
import {
  firewallChainName,
  validatePolicies,
  validatePolicy,
  type FirewallPolicy,
} from "@rebroid/firewall-policy-core/policy";

const ROOT_CHAIN = "REBROID_FW";
const NEXT_SUFFIX = "_NEXT";
const APP_CHAIN_PREFIX = "RB_APP_";
const LEGACY_APP_CHAIN_PREFIX = "REBROID_APP_";
const NFT_TABLE = "rebroid_fw";

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

  initialize() {
    this.runner.run("iptables", ["-N", ROOT_CHAIN], { ignoreFailure: true });
    if (
      !this.runner.run("iptables", ["-C", this.anchor, "-j", ROOT_CHAIN], {
        ignoreFailure: true,
      }).ok
    ) {
      this.runner.run("iptables", ["-I", this.anchor, "1", "-j", ROOT_CHAIN]);
    }
  }

  apply(policy: FirewallPolicy) {
    this.initialize();
    const chain = chainName(policy.applicationId);
    const nextChain = `${chain}${NEXT_SUFFIX}`;
    this.removeChain(nextChain);
    this.runner.run("iptables", ["-N", nextChain]);
    for (const cidr of policy.allowCidrs) {
      this.runner.run("iptables", [
        "-A",
        nextChain,
        "-d",
        cidr,
        "-j",
        "ACCEPT",
      ]);
    }
    this.runner.run("iptables", ["-A", nextChain, "-j", "REJECT"]);
    this.runner.run("iptables", [
      "-A",
      ROOT_CHAIN,
      "-s",
      policy.containerIp,
      "-j",
      nextChain,
    ]);
    this.removeJump(chain);
    this.removeChain(chain);
    this.runner.run("iptables", ["-E", nextChain, chain]);
  }

  remove(applicationId: string) {
    const chain = chainName(applicationId);
    this.removeJump(chain);
    this.removeJump(`${chain}${NEXT_SUFFIX}`);
    this.removeChain(chain);
    this.removeChain(`${chain}${NEXT_SUFFIX}`);
  }

  reconcile(policies: Map<string, FirewallPolicy>) {
    this.initialize();
    const nextRoot = `${ROOT_CHAIN}${NEXT_SUFFIX}`;
    this.removeAnchorJump(nextRoot);
    this.removeChain(nextRoot);
    this.runner.run("iptables", ["-N", nextRoot]);
    const replacements: Array<{ chain: string; nextChain: string }> = [];
    for (const policy of policies.values()) {
      if (!policy.enabled) continue;
      const chain = chainName(policy.applicationId);
      const nextChain = this.createNextPolicyChain(chain, policy.allowCidrs);
      replacements.push({ chain, nextChain });
      this.runner.run("iptables", [
        "-A",
        nextRoot,
        "-s",
        policy.containerIp,
        "-j",
        nextChain,
      ]);
    }
    this.runner.run("iptables", ["-I", this.anchor, "1", "-j", nextRoot]);
    this.removeAnchorJump(ROOT_CHAIN);
    this.removeChain(ROOT_CHAIN);
    this.runner.run("iptables", ["-E", nextRoot, ROOT_CHAIN]);
    for (const { chain, nextChain } of replacements) {
      this.removeChain(chain);
      this.runner.run("iptables", ["-E", nextChain, chain]);
    }
    this.removeStaleOwnedChains(
      new Set(replacements.map(({ chain }) => chain)),
    );
  }

  private createNextPolicyChain(chain: string, cidrs: string[]) {
    const nextChain = `${chain}${NEXT_SUFFIX}`;
    this.removeChain(nextChain);
    this.runner.run("iptables", ["-N", nextChain]);
    for (const cidr of cidrs) {
      this.runner.run("iptables", [
        "-A",
        nextChain,
        "-d",
        cidr,
        "-j",
        "ACCEPT",
      ]);
    }
    this.runner.run("iptables", ["-A", nextChain, "-j", "REJECT"]);
    return nextChain;
  }

  private removeAnchorJump(chain: string) {
    while (
      this.runner.run("iptables", ["-C", this.anchor, "-j", chain], {
        ignoreFailure: true,
      }).ok
    ) {
      this.runner.run("iptables", ["-D", this.anchor, "-j", chain], {
        ignoreFailure: true,
      });
    }
  }

  private removeChain(chain: string) {
    this.runner.run("iptables", ["-F", chain], { ignoreFailure: true });
    this.runner.run("iptables", ["-X", chain], { ignoreFailure: true });
  }

  private removeStaleOwnedChains(activeChains: Set<string>) {
    const chains = this.runner
      .run("iptables", ["-S"], { ignoreFailure: true })
      .output.split("\n")
      .filter(
        (rule) =>
          rule.startsWith(`-N ${APP_CHAIN_PREFIX}`) ||
          rule.startsWith(`-N ${LEGACY_APP_CHAIN_PREFIX}`),
      )
      .map((rule) => rule.slice("-N ".length).trim());
    for (const chain of chains) {
      if (!activeChains.has(chain)) {
        this.removeChain(chain);
      }
    }
  }

  private removeJump(chain: string) {
    const rules = this.runner
      .run("iptables", ["-S", ROOT_CHAIN], {
        ignoreFailure: true,
      })
      .output.split("\n");
    for (const rule of rules) {
      if (!rule.endsWith(`-j ${chain}`)) continue;
      const args = rule.replace(`-A ${ROOT_CHAIN} `, "").trim().split(/\s+/);
      this.runner.run("iptables", ["-D", ROOT_CHAIN, ...args], {
        ignoreFailure: true,
      });
    }
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
    for (const policy of policies.values()) {
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
