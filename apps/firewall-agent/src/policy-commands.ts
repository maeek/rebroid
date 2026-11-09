import type { FirewallAdapter, FirewallPolicy } from "./firewall";
import type { FirewallPolicyStore } from "./policy-store";

// Policy IDs cannot contain JSON punctuation, so scoped and app-wide removals share the store.
const containerRemovalKey = (id: string, containerId: string) =>
  JSON.stringify([id, containerId]);

export class FirewallPolicyCommands {
  constructor(
    private readonly adapter: FirewallAdapter,
    private readonly store: FirewallPolicyStore,
  ) {}

  reconcile(desired: Map<string, FirewallPolicy>, startedAt?: number) {
    const state = this.store.snapshot();
    if (
      startedAt !== undefined &&
      state.lastReconciledAt !== null &&
      startedAt < state.lastReconciledAt
    ) {
      return "stale";
    }

    for (const [id, policy] of desired) {
      const generation = startedAt ?? policy.generation;
      if (
        this.wasRemoved(state.removals, policy, generation) ||
        (state.lastReconciledAt !== null && generation < state.lastReconciledAt)
      ) {
        desired.delete(id);
      } else if (generation !== policy.generation) {
        desired.set(id, { ...policy, generation });
      }
    }
    for (const [id, policy] of state.policies) {
      if (
        policy.startup ||
        state.policies.get(`startup-${id}`)?.startup ||
        (startedAt !== undefined && policy.generation >= startedAt)
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
    this.store.save(state);
    this.adapter.reconcile(desired);
    return "applied";
  }

  apply(policy: FirewallPolicy) {
    const state = this.store.snapshot();
    const id = policy.applicationId;
    const existing = state.policies.get(id);
    if (
      (existing && existing.generation > policy.generation) ||
      this.wasRemoved(state.removals, policy, policy.generation) ||
      (!existing &&
        state.lastReconciledAt !== null &&
        state.lastReconciledAt > policy.generation)
    ) {
      return "stale";
    }

    state.policies.set(id, policy);
    state.removals.delete(id);
    state.removals.delete(containerRemovalKey(id, policy.containerId));
    this.store.save(state);
    if (policy.enabled) this.adapter.apply(policy, state.policies);
    else this.adapter.remove(id, state.policies);
    return "applied";
  }

  remove(id: string, expectedContainerId?: string, generation?: number) {
    const state = this.store.snapshot();
    const existing = state.policies.get(id);
    if (
      generation !== undefined &&
      ((existing && existing.generation >= generation) ||
        (state.lastReconciledAt !== null &&
          state.lastReconciledAt > generation))
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
    // Keep the persisted protection if the host rejects the removal.
    this.adapter.remove(id, state.policies);
    this.store.save(state);
    return "applied";
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
