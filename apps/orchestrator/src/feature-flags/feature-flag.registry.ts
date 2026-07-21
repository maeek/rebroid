export const featureFlagKeys = [
  'feature.ocr',
  'feature.firewall',
  'feature.image-builder',
  'feature.display-virtual',
] as const;

export type FeatureFlagKey = (typeof featureFlagKeys)[number];
export type FeatureFlagControl = 'runtime' | 'deployment';
export type FeatureDisablePolicy =
  | 'block_new'
  | 'drain_active'
  | 'stop_active'
  | 'restart_required';

export interface FeatureFlagDefinition {
  key: FeatureFlagKey;
  description: string;
  owner: 'automations' | 'network-policy' | 'container-images' | 'display';
  control: FeatureFlagControl;
  defaultEnabled: boolean;
  disablePolicy: FeatureDisablePolicy;
  lifecycle: 'permanent' | 'rollout';
  removalCondition: string | null;
  dependencies: readonly FeatureFlagKey[];
  conflicts: readonly FeatureFlagKey[];
  supportConfigKey?: string;
}

export const featureFlagDefinitions: readonly FeatureFlagDefinition[] = [
  {
    key: 'feature.ocr',
    description: 'OCR-backed automation perception.',
    owner: 'automations',
    control: 'runtime',
    defaultEnabled: true,
    disablePolicy: 'block_new',
    lifecycle: 'permanent',
    removalCondition: null,
    dependencies: [],
    conflicts: [],
    supportConfigKey: 'app.ocr.baseUrl',
  },
  {
    key: 'feature.firewall',
    description: 'Host firewall policy enforcement.',
    owner: 'network-policy',
    control: 'runtime',
    defaultEnabled: true,
    disablePolicy: 'block_new',
    lifecycle: 'permanent',
    removalCondition: null,
    dependencies: [],
    conflicts: [],
    supportConfigKey: 'app.firewallAgent.socketPath',
  },
  {
    key: 'feature.image-builder',
    description: 'Custom and managed container image builds.',
    owner: 'container-images',
    control: 'runtime',
    defaultEnabled: true,
    disablePolicy: 'drain_active',
    lifecycle: 'permanent',
    removalCondition: null,
    dependencies: [],
    conflicts: [],
  },
  {
    key: 'feature.display-virtual',
    description: 'Experimental virtual display sessions.',
    owner: 'display',
    control: 'runtime',
    defaultEnabled: false,
    disablePolicy: 'drain_active',
    lifecycle: 'permanent',
    removalCondition: null,
    dependencies: [],
    conflicts: [],
  },
] as const;

const knownKeys = new Set<string>(featureFlagKeys);

export const isFeatureFlagKey = (value: string): value is FeatureFlagKey =>
  knownKeys.has(value);
