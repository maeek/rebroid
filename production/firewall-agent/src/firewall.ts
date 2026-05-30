import { execFileSync } from "node:child_process";

const ROOT_CHAIN = "REBROID_FW";
const NEXT_SUFFIX = "_NEXT";
const NFT_TABLE = "rebroid_fw";
const MAX_ALLOW_CIDRS = 256;
const APPLICATION_ID = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,63}$/;
const CONTAINER_ID = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/;
const IPV4_CIDR =
  /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}\/(3[0-2]|[12]?\d)$/;

export interface FirewallPolicy {
  applicationId: string;
  containerId: string;
  containerIp: string;
  enabled: boolean;
  allowCidrs: string[];
  generation: number;
}

export interface FirewallAdapter {
  name: string;
  initialize(): void;
  apply(policy: FirewallPolicy, policies: Map<string, FirewallPolicy>): void;
  remove(applicationId: string, policies: Map<string, FirewallPolicy>): void;
  reconcile(policies: Map<string, FirewallPolicy>): void;
}

const run = (
  binary: string,
  args: string[],
  options: { ignoreFailure?: boolean; input?: string } = {},
) => {
  try {
    return {
      ok: true,
      output: execFileSync(binary, args, {
        encoding: "utf8",
        input: options.input,
      }),
    };
  } catch (error) {
    if (options.ignoreFailure) return { ok: false, output: "" };
    throw error;
  }
};

export const chainName = (applicationId: string) =>
  `REBROID_APP_${applicationId.replace(/-/g, "").slice(0, 16).toUpperCase()}`;

export const validatePolicy = (
  applicationId: string,
  body: Partial<FirewallPolicy>,
): FirewallPolicy => {
  if (!APPLICATION_ID.test(applicationId))
    throw new Error("Invalid application id.");
  if (!CONTAINER_ID.test(body.containerId ?? ""))
    throw new Error("Invalid container id.");
  if (!IPV4_CIDR.test(`${body.containerIp}/32`))
    throw new Error("Invalid container address.");
  if (!Number.isSafeInteger(body.generation) || (body.generation ?? -1) < 0) {
    throw new Error("Invalid policy generation.");
  }
  if (
    !Array.isArray(body.allowCidrs) ||
    body.allowCidrs.length > MAX_ALLOW_CIDRS
  ) {
    throw new Error("Invalid allowlist.");
  }
  if (
    !body.allowCidrs.every(
      (cidr) => typeof cidr === "string" && IPV4_CIDR.test(cidr),
    )
  ) {
    throw new Error("Only IPv4 CIDRs are supported.");
  }
  return {
    applicationId,
    containerId: body.containerId!,
    containerIp: body.containerIp!,
    enabled: body.enabled !== false,
    allowCidrs: [...new Set(body.allowCidrs)],
    generation: body.generation!,
  };
};

export const validatePolicies = (body: {
  policies?: Partial<FirewallPolicy>[];
}) => {
  if (!Array.isArray(body.policies)) throw new Error("Invalid policy list.");
  const desired = new Map<string, FirewallPolicy>();
  for (const policy of body.policies) {
    if (typeof policy.applicationId !== "string")
      throw new Error("Invalid application id.");
    desired.set(
      policy.applicationId,
      validatePolicy(policy.applicationId, policy),
    );
  }
  return desired;
};

export class IptablesAdapter implements FirewallAdapter {
  readonly name: string;

  constructor(private readonly anchor: "DOCKER-USER" | "FORWARD") {
    this.name =
      anchor === "DOCKER-USER" ? "docker-iptables" : "podman-iptables";
  }

  initialize() {
    run("iptables", ["-N", ROOT_CHAIN], { ignoreFailure: true });
    if (
      !run("iptables", ["-C", this.anchor, "-j", ROOT_CHAIN], {
        ignoreFailure: true,
      }).ok
    ) {
      run("iptables", ["-I", this.anchor, "1", "-j", ROOT_CHAIN]);
    }
  }

  apply(policy: FirewallPolicy) {
    this.initialize();
    const chain = chainName(policy.applicationId);
    const nextChain = `${chain}${NEXT_SUFFIX}`;
    this.removeChain(nextChain);
    run("iptables", ["-N", nextChain]);
    for (const cidr of policy.allowCidrs) {
      run("iptables", ["-A", nextChain, "-d", cidr, "-j", "ACCEPT"]);
    }
    run("iptables", ["-A", nextChain, "-j", "REJECT"]);
    run("iptables", [
      "-A",
      ROOT_CHAIN,
      "-s",
      policy.containerIp,
      "-j",
      nextChain,
    ]);
    this.removeJump(chain);
    this.removeChain(chain);
    run("iptables", ["-E", nextChain, chain]);
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
    run("iptables", ["-N", nextRoot]);
    const replacements: Array<{ chain: string; nextChain: string }> = [];
    for (const policy of policies.values()) {
      if (!policy.enabled) continue;
      const chain = chainName(policy.applicationId);
      const nextChain = this.createNextPolicyChain(chain, policy.allowCidrs);
      replacements.push({ chain, nextChain });
      run("iptables", [
        "-A",
        nextRoot,
        "-s",
        policy.containerIp,
        "-j",
        nextChain,
      ]);
    }
    run("iptables", ["-I", this.anchor, "1", "-j", nextRoot]);
    this.removeAnchorJump(ROOT_CHAIN);
    this.removeChain(ROOT_CHAIN);
    run("iptables", ["-E", nextRoot, ROOT_CHAIN]);
    for (const { chain, nextChain } of replacements) {
      this.removeChain(chain);
      run("iptables", ["-E", nextChain, chain]);
    }
    this.removeStaleOwnedChains(
      new Set(replacements.map(({ chain }) => chain)),
    );
  }

  private createNextPolicyChain(chain: string, cidrs: string[]) {
    const nextChain = `${chain}${NEXT_SUFFIX}`;
    this.removeChain(nextChain);
    run("iptables", ["-N", nextChain]);
    for (const cidr of cidrs) {
      run("iptables", ["-A", nextChain, "-d", cidr, "-j", "ACCEPT"]);
    }
    run("iptables", ["-A", nextChain, "-j", "REJECT"]);
    return nextChain;
  }

  private removeAnchorJump(chain: string) {
    while (
      run("iptables", ["-C", this.anchor, "-j", chain], {
        ignoreFailure: true,
      }).ok
    ) {
      run("iptables", ["-D", this.anchor, "-j", chain], {
        ignoreFailure: true,
      });
    }
  }

  private removeChain(chain: string) {
    run("iptables", ["-F", chain], { ignoreFailure: true });
    run("iptables", ["-X", chain], { ignoreFailure: true });
  }

  private removeStaleOwnedChains(activeChains: Set<string>) {
    const chains = run("iptables", ["-S"], { ignoreFailure: true })
      .output.split("\n")
      .filter((rule) => rule.startsWith("-N REBROID_APP_"))
      .map((rule) => rule.slice("-N ".length).trim());
    for (const chain of chains) {
      if (!activeChains.has(chain)) {
        this.removeChain(chain);
      }
    }
  }

  private removeJump(chain: string) {
    const rules = run("iptables", ["-S", ROOT_CHAIN], {
      ignoreFailure: true,
    }).output.split("\n");
    for (const rule of rules) {
      if (!rule.endsWith(`-j ${chain}`)) continue;
      const args = rule.replace(`-A ${ROOT_CHAIN} `, "").trim().split(/\s+/);
      run("iptables", ["-D", ROOT_CHAIN, ...args], { ignoreFailure: true });
    }
  }
}

export class NftablesAdapter implements FirewallAdapter {
  readonly name = "nftables";

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
    const exists = run("nft", ["list", "table", "inet", NFT_TABLE], {
      ignoreFailure: true,
    }).ok;
    run("nft", ["-f", "-"], {
      input: `${exists ? `delete table inet ${NFT_TABLE}\n` : ""}${lines.join("\n")}\n`,
    });
  }
}

export const detectAdapter = (requested = "auto"): FirewallAdapter => {
  if (requested === "docker-iptables")
    return new IptablesAdapter("DOCKER-USER");
  if (requested === "podman-iptables") return new IptablesAdapter("FORWARD");
  if (requested === "nftables") return new NftablesAdapter();
  if (requested !== "auto")
    throw new Error(`Unsupported firewall adapter: ${requested}`);
  if (run("iptables", ["-S", "DOCKER-USER"], { ignoreFailure: true }).ok)
    return new IptablesAdapter("DOCKER-USER");
  if (run("nft", ["list", "tables"], { ignoreFailure: true }).ok)
    return new NftablesAdapter();
  if (run("iptables", ["-S", "FORWARD"], { ignoreFailure: true }).ok)
    return new IptablesAdapter("FORWARD");
  throw new Error("No supported host firewall backend was detected.");
};
