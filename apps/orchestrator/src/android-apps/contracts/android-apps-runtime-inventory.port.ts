export const ANDROID_APPS_RUNTIME_INVENTORY = Symbol(
  'ANDROID_APPS_RUNTIME_INVENTORY',
);

export interface NetworkPolicyTarget {
  id: string;
  containerId: string | null;
  networkName: string;
  networkPolicyEnabled: boolean;
  networkPolicyAllowCidrs: string;
}

export interface AndroidAppsRuntimeInventoryPort {
  findExistingIds(applicationIds: string[]): Promise<ReadonlySet<string>>;
  findRunningNetworkPolicyTargets(): Promise<NetworkPolicyTarget[]>;
}
