export const ANDROID_APPS_RUNTIME_INVENTORY = Symbol(
  'ANDROID_APPS_RUNTIME_INVENTORY',
);

export interface NetworkPolicyTarget {
  id: string;
  containerId: string | null;
  networkName: string;
  networkPolicyEnabled: boolean;
  networkPolicyAllowCidrs: string;
  networkPolicyRevision: number;
}

export interface RestrictedRuntimePolicyTarget extends NetworkPolicyTarget {
  containerId: string;
}

export interface AndroidAppsRuntimeInventoryPort {
  findExistingIds(applicationIds: string[]): Promise<ReadonlySet<string>>;
  findRestrictedRuntimePolicyTargets(
    applicationIds?: string[],
  ): Promise<RestrictedRuntimePolicyTarget[]>;
}
