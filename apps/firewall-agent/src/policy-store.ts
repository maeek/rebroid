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

export class FirewallPolicyStore {
  private readonly policies = new Map<string, FirewallPolicy>();

  constructor(private readonly statePath: string) {}

  load() {
    if (!existsSync(this.statePath)) return this.snapshot();
    const stored = JSON.parse(
      readFileSync(this.statePath, "utf8"),
    ) as FirewallPolicy[];
    this.policies.clear();
    for (const policy of stored) {
      this.policies.set(
        policy.applicationId,
        validatePolicy(policy.applicationId, policy),
      );
    }
    return this.snapshot();
  }

  snapshot() {
    return new Map(this.policies);
  }

  replace(desired: Map<string, FirewallPolicy>) {
    this.policies.clear();
    for (const [applicationId, policy] of desired) {
      this.policies.set(applicationId, policy);
    }
    this.persist();
    return this.snapshot();
  }

  set(policy: FirewallPolicy) {
    this.policies.set(policy.applicationId, policy);
    this.persist();
    return this.snapshot();
  }

  delete(applicationId: string) {
    this.policies.delete(applicationId);
    this.persist();
    return this.snapshot();
  }

  get(applicationId: string) {
    return this.policies.get(applicationId);
  }

  private persist() {
    mkdirSync(dirname(this.statePath), { recursive: true });
    const temporaryPath = `${this.statePath}.${process.pid}.tmp`;
    const descriptor = openSync(temporaryPath, "w", 0o600);
    try {
      writeFileSync(descriptor, JSON.stringify([...this.policies.values()]));
      fsyncSync(descriptor);
    } finally {
      closeSync(descriptor);
    }
    try {
      renameSync(temporaryPath, this.statePath);
    } catch (error) {
      try {
        unlinkSync(temporaryPath);
      } catch {}
      throw error;
    }
  }
}
