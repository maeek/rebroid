import type { FirewallAdapter, FirewallPolicy } from "./firewall";
import type { FirewallPolicyState, FirewallPolicyStore } from "./policy-store";

// Policy IDs cannot contain JSON punctuation, so scoped and app-wide removals share the store.
const containerRemovalKey = (id: string, containerId: string) =>
  JSON.stringify([id, containerId]);

export type FirewallPolicyRecovery =
  | { commands: FirewallPolicyCommands; adapterName: string }
  | { commands?: never; adapterName?: string; error: unknown };

export const firewallRecoveryPendingMessage =
  "Firewall rules could not be restored from committed policy state.";

export class FirewallPolicyRecoveryPendingError extends Error {
  constructor(cause: unknown) {
    super(firewallRecoveryPendingMessage, { cause });
  }
}

export class FirewallPolicyCommands {
  private needsRecovery = false;

  get recoveryPending() {
    return this.needsRecovery;
  }

  private constructor(
    private readonly adapter: FirewallAdapter,
    private readonly store: FirewallPolicyStore,
  ) {}

  static restore(
    store: FirewallPolicyStore,
    selectAdapter: () => FirewallAdapter,
  ): FirewallPolicyRecovery {
    let adapter: FirewallAdapter | undefined;
    try {
      const { policies } = store.load();
      adapter = selectAdapter();
      adapter.initialize();
      adapter.reconcile(policies);
      return {
        commands: new FirewallPolicyCommands(adapter, store),
        adapterName: adapter.name,
      };
    } catch (error) {
      return { adapterName: adapter?.name, error };
    }
  }

  reconcile(desired: Map<string, FirewallPolicy>, startedAt?: number) {
    this.recoverIfNeeded();
    const state = this.store.snapshot();
    if (
      startedAt !== undefined &&
      state.lastReconciledAt !== null &&
      startedAt < state.lastReconciledAt
    ) {
      return "stale";
    }

    for (const [id, policy] of desired) {
      const existing = state.policies.get(id);
      const generation = startedAt ?? policy.generation;
      const newerRevisionForSameRuntime =
        existing?.containerId === policy.containerId &&
        (policy.revision ?? 0) > (existing.revision ?? 0);
      if (
        (policy.revision ?? 0) < (state.revisions.get(id) ?? 0) ||
        this.wasRemoved(state.removals, policy, generation) ||
        (!newerRevisionForSameRuntime &&
          ((state.lastReconciledAt !== null &&
            generation < state.lastReconciledAt) ||
            (existing && existing.generation >= generation)))
      ) {
        if (existing) desired.set(id, existing);
        else desired.delete(id);
      } else if (generation !== policy.generation) {
        desired.set(id, { ...policy, generation });
      }
    }
    for (const [id, policy] of state.policies) {
      if (
        policy.startup ||
        state.policies.get(`startup-${id}`)?.startup ||
        (!desired.has(id) &&
          startedAt !== undefined &&
          policy.generation >= startedAt)
      ) {
        desired.set(id, policy);
      }
    }
    if (startedAt !== undefined) {
      state.lastReconciledAt = startedAt;
      // The durable snapshot timestamp blocks older replays after pruning removals.
      for (const [id, removedAt] of state.removals) {
        if (removedAt < startedAt) state.removals.delete(id);
      }
    }

    state.policies = desired;
    for (const { applicationId, revision } of desired.values()) {
      if (revision !== undefined) {
        state.revisions.set(
          applicationId,
          Math.max(state.revisions.get(applicationId) ?? 0, revision),
        );
      }
    }
    this.commit(state, () => this.adapter.reconcile(desired));
    return "applied";
  }

  apply(policy: FirewallPolicy) {
    this.recoverIfNeeded();
    const state = this.store.snapshot();
    const id = policy.applicationId;
    const existing = state.policies.get(id);
    if (
      (policy.revision ?? 0) < (state.revisions.get(id) ?? 0) ||
      (existing &&
        (existing.revision ?? 0) === (policy.revision ?? 0) &&
        existing.generation > policy.generation) ||
      this.wasRemoved(state.removals, policy, policy.generation) ||
      (!existing &&
        state.lastReconciledAt !== null &&
        state.lastReconciledAt > policy.generation)
    ) {
      return "stale";
    }

    state.policies.set(id, policy);
    if (policy.revision !== undefined) state.revisions.set(id, policy.revision);
    state.removals.delete(id);
    state.removals.delete(containerRemovalKey(id, policy.containerId));
    this.commit(state, () => {
      if (policy.enabled) this.adapter.apply(policy, state.policies);
      else this.adapter.remove(id, state.policies);
    });
    return "applied";
  }

  refresh(policy: FirewallPolicy) {
    this.recoverIfNeeded();
    const existing = this.store.snapshot().policies.get(policy.applicationId);
    if (
      !policy.enabled ||
      policy.startup ||
      policy.revision === undefined ||
      !existing?.enabled ||
      existing.startup ||
      existing.containerId !== policy.containerId ||
      (existing.revision ?? 0) !== policy.revision
    ) {
      return "stale";
    }
    return this.apply(policy);
  }

  remove(
    id: string,
    expectedContainerId?: string,
    generation?: number,
    revision?: number,
  ) {
    this.recoverIfNeeded();
    const state = this.store.snapshot();
    const existing = state.policies.get(id);
    if (
      (revision ?? 0) < (state.revisions.get(id) ?? 0) ||
      (generation !== undefined &&
        ((existing &&
          (existing.revision ?? 0) === (revision ?? 0) &&
          existing.generation >= generation) ||
          (state.lastReconciledAt !== null &&
            state.lastReconciledAt > generation)))
    ) {
      return "unchanged";
    }
    if (
      expectedContainerId !== undefined &&
      existing &&
      existing.containerId !== expectedContainerId
    ) {
      return "unchanged";
    }

    const key =
      expectedContainerId === undefined
        ? id
        : containerRemovalKey(id, expectedContainerId);
    if (revision !== undefined) state.revisions.set(id, revision);
    state.removals.set(
      key,
      Math.max(
        generation ?? Date.now(),
        existing?.generation ?? 0,
        state.removals.get(key) ?? 0,
      ),
    );
    if (expectedContainerId !== undefined && !existing) {
      this.store.save(state);
      return "unchanged";
    }

    state.policies.delete(id);
    this.commit(state, () => this.adapter.remove(id, state.policies));
    return "applied";
  }

  private recoverIfNeeded() {
    if (!this.needsRecovery) return;
    try {
      this.adapter.reconcile(this.store.snapshot().policies);
      this.needsRecovery = false;
    } catch (error) {
      throw new FirewallPolicyRecoveryPendingError(error);
    }
  }

  private commit(next: FirewallPolicyState, install: () => void) {
    let installed = false;
    try {
      this.store.save(next, () => {
        install();
        installed = true;
      });
    } catch (error) {
      if (installed) {
        try {
          this.adapter.reconcile(this.store.snapshot().policies);
        } catch (rollbackError) {
          this.needsRecovery = true;
          throw new AggregateError(
            [error, rollbackError],
            "Could not persist the firewall update or restore the previous rules.",
          );
        }
      }
      throw error;
    }
  }

  private wasRemoved(
    removals: Map<string, number>,
    policy: FirewallPolicy,
    generation: number,
  ) {
    const { applicationId, containerId } = policy;
    return (
      generation <=
      Math.max(
        removals.get(applicationId) ?? -1,
        removals.get(containerRemovalKey(applicationId, containerId)) ?? -1,
      )
    );
  }
}
