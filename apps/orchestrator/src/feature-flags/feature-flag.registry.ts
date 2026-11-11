export const featureFlagKeys = [
  'feature.ocr',
  'feature.firewall',
  'feature.image-builder',
  'feature.display-virtual',
  'feature.ai',
  'feature.workflows',
  'feature.resource-quota',
  'feature.display-webrtc',
] as const;

export type FeatureFlagKey = (typeof featureFlagKeys)[number];
export type FeatureFlagControl = 'runtime' | 'deployment';
export type FeatureDisablePolicy =
  'block_new' | 'drain_active' | 'stop_active' | 'restart_required';

export const featureOwners = [
  'automations',
  'network-policy',
  'container-images',
  'display',
  'android-apps',
] as const;

export interface FeatureFlagDefinition {
  key: FeatureFlagKey;
  description: string;
  owner: (typeof featureOwners)[number];
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
  {
    key: 'feature.ai',
    description: 'AI providers, device-agent tasks, and workflow drafting.',
    owner: 'automations',
    control: 'runtime',
    defaultEnabled: false,
    disablePolicy: 'block_new',
    lifecycle: 'permanent',
    removalCondition: null,
    dependencies: [],
    conflicts: [],
  },
  {
    key: 'feature.workflows',
    description: 'Workflow editing, manual runs, and scheduled triggers.',
    owner: 'automations',
    control: 'runtime',
    defaultEnabled: true,
    disablePolicy: 'drain_active',
    lifecycle: 'permanent',
    removalCondition: null,
    dependencies: [],
    conflicts: [],
  },
  {
    key: 'feature.resource-quota',
    description: 'Per-user open app, CPU, memory, and session limits.',
    owner: 'android-apps',
    control: 'runtime',
    defaultEnabled: true,
    disablePolicy: 'block_new',
    lifecycle: 'permanent',
    removalCondition: null,
    dependencies: [],
    conflicts: [],
  },
  {
    key: 'feature.display-webrtc',
    description: 'Live viewer streaming over WebRTC.',
    owner: 'display',
    control: 'runtime',
    defaultEnabled: true,
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

export const defaultRuntimeFeatureFlagValues = (
  getSupportConfig: (key: string) => unknown,
): Partial<Record<FeatureFlagKey, boolean>> =>
  Object.fromEntries(
    featureFlagDefinitions
      .filter((definition) => definition.control === 'runtime')
      .map((definition) => [
        definition.key,
        definition.defaultEnabled &&
          (!definition.supportConfigKey ||
            Boolean(getSupportConfig(definition.supportConfigKey))),
      ]),
  );
