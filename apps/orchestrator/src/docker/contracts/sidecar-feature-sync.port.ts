export const SIDECAR_FEATURE_SYNC = Symbol('SIDECAR_FEATURE_SYNC');

export interface SidecarFeatureSyncPort {
  synchronizeFeatures(): Promise<void>;
}
