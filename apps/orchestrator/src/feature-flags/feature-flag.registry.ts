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

const definitions = {
  'feature.ocr': {
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
  'feature.firewall': {
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
  'feature.image-builder': {
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
  'feature.display-virtual': {
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
  'feature.ai': {
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
  'feature.workflows': {
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
  'feature.resource-quota': {
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
  'feature.display-webrtc': {
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
} as const;

export type FeatureFlagKey = keyof typeof definitions;
export const featureFlagRegistry: Readonly<
  Record<FeatureFlagKey, FeatureFlagDefinition>
> = definitions;
export const featureFlagKeys = Object.keys(
  featureFlagRegistry,
) as FeatureFlagKey[];
export const featureFlagDefinitions = featureFlagKeys.map((key) => ({
  key,
  ...featureFlagRegistry[key],
}));

export const isFeatureFlagKey = (value: string): value is FeatureFlagKey =>
  Object.hasOwn(featureFlagRegistry, value);

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
