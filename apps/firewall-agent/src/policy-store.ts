import { randomUUID } from "node:crypto";
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import {
  type FirewallPolicy,
  validatePolicies,
} from "@rebroid/firewall-policy-core/policy";

export interface FirewallPolicyState {
  policies: Map<string, FirewallPolicy>;
  removals: Map<string, number>;
  revisions: Map<string, number>;
  lastReconciledAt: number | null;
}

interface StoredPolicyState {
  policies: FirewallPolicy[];
  removals: [string, number][];
  revisions: [string, number][];
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
    const stored = JSON.parse(
      readFileSync(this.statePath, "utf8"),
    ) as StoredPolicyState | null;
    if (
      !Array.isArray(stored?.policies) ||
      !Array.isArray(stored.removals) ||
      !Array.isArray(stored.revisions) ||
      (stored.lastReconciledAt !== null &&
        (!Number.isSafeInteger(stored.lastReconciledAt) ||
          stored.lastReconciledAt < 0)) ||
      [...stored.removals, ...stored.revisions].some(
        (entry) =>
          !Array.isArray(entry) ||
          typeof entry[0] !== "string" ||
          !Number.isSafeInteger(entry[1]) ||
          entry[1] < 0,
      )
    ) {
      throw new Error("Invalid persisted firewall policy state.");
    }
    this.state = {
      policies: validatePolicies(stored),
      removals: new Map(stored.removals),
      revisions: new Map(stored.revisions),
      lastReconciledAt: stored.lastReconciledAt,
    };
    return this.snapshot();
  }

  snapshot(): FirewallPolicyState {
    return structuredClone(this.state);
  }

  save(next: FirewallPolicyState, beforeCommit?: () => void) {
    const committed = structuredClone(next);
    const stored: StoredPolicyState = {
      policies: [...committed.policies.values()],
      removals: [...committed.removals],
      revisions: [...committed.revisions],
      lastReconciledAt: committed.lastReconciledAt,
    };
    mkdirSync(dirname(this.statePath), { recursive: true });
    const temporaryPath = `${this.statePath}.${randomUUID()}.tmp`;
    const descriptor = openSync(temporaryPath, "wx", 0o600);
    try {
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
    this.state = committed;
  }
}
