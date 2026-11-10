import {
  closeSync,
  existsSync,
  fsyncSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import { mkdirSync } from "node:fs";
import { FirewallPolicy, validatePolicy } from "./firewall";

export interface FirewallPolicyState {
  policies: Map<string, FirewallPolicy>;
  removals: Map<string, number>;
  revisions: Map<string, number>;
  lastReconciledAt: number | null;
}

interface StoredPolicyState {
  policies: FirewallPolicy[];
  removals: [string, number][];
  revisions?: [string, number][];
  lastReconciledAt: number | null;
}

export class FirewallPolicyStore {
  private state: FirewallPolicyState = {
    policies: new Map(),
    removals: new Map(),
    revisions: new Map(),
    lastReconciledAt: null,
  };

  constructor(private readonly statePath: string) {}

  load() {
    if (!existsSync(this.statePath)) return this.snapshot();
    const stored = JSON.parse(readFileSync(this.statePath, "utf8")) as
      StoredPolicyState | FirewallPolicy[];
    const policies = new Map<string, FirewallPolicy>();
    const legacy = Array.isArray(stored);
    if (
      !legacy &&
      (!Array.isArray(stored.policies) ||
        !Array.isArray(stored.removals) ||
        (stored.lastReconciledAt !== null &&
          (!Number.isSafeInteger(stored.lastReconciledAt) ||
            stored.lastReconciledAt < 0)) ||
        (stored.revisions !== undefined && !Array.isArray(stored.revisions)) ||
        [...stored.removals, ...(stored.revisions ?? [])].some(
          (entry) =>
            !Array.isArray(entry) ||
            typeof entry[0] !== "string" ||
            !Number.isSafeInteger(entry[1]) ||
            entry[1] < 0,
        ))
    ) {
      throw new Error("Invalid persisted firewall policy state.");
    }
    for (const policy of legacy ? stored : stored.policies) {
      policies.set(
        policy.applicationId,
        validatePolicy(policy.applicationId, policy),
      );
    }
    const revisions = new Map(legacy ? [] : (stored.revisions ?? []));
    for (const { applicationId, revision } of policies.values()) {
      if (revision !== undefined) {
        revisions.set(
          applicationId,
          Math.max(revisions.get(applicationId) ?? 0, revision),
        );
      }
    }
    this.state = {
      policies,
      removals: new Map(legacy ? [] : stored.removals),
      revisions,
      lastReconciledAt: legacy ? null : stored.lastReconciledAt,
    };
    return this.snapshot();
  }

  snapshot(): FirewallPolicyState {
    return {
      policies: new Map(this.state.policies),
      removals: new Map(this.state.removals),
      revisions: new Map(this.state.revisions),
      lastReconciledAt: this.state.lastReconciledAt,
    };
  }

  save(next: FirewallPolicyState, beforeCommit?: () => void) {
    const stored: StoredPolicyState = {
      policies: [...next.policies.values()],
      removals: [...next.removals],
      revisions: [...next.revisions],
      lastReconciledAt: next.lastReconciledAt,
    };
    mkdirSync(dirname(this.statePath), { recursive: true });
    const temporaryPath = `${this.statePath}.${process.pid}.tmp`;
    try {
      const descriptor = openSync(temporaryPath, "w", 0o600);
      try {
        writeFileSync(descriptor, JSON.stringify(stored));
        fsyncSync(descriptor);
      } finally {
        closeSync(descriptor);
      }
      beforeCommit?.();
      renameSync(temporaryPath, this.statePath);
    } catch (error) {
      try {
        unlinkSync(temporaryPath);
      } catch {}
      throw error;
    }
    this.state = next;
  }
}
