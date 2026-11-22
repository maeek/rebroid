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

const permanentRuntimeFlag = {
  control: 'runtime',
  lifecycle: 'permanent',
  removalCondition: null,
  dependencies: [],
  conflicts: [],
} as const;

const definitions = {
  'feature.ocr': {
    ...permanentRuntimeFlag,
    description: 'OCR-backed automation perception.',
    owner: 'automations',
    defaultEnabled: true,
    disablePolicy: 'block_new',
    supportConfigKey: 'app.ocr.baseUrl',
  },
  'feature.firewall': {
    ...permanentRuntimeFlag,
    description: 'Host firewall policy enforcement.',
    owner: 'network-policy',
    defaultEnabled: true,
    disablePolicy: 'block_new',
    supportConfigKey: 'app.firewallAgent.socketPath',
  },
  'feature.image-builder': {
    ...permanentRuntimeFlag,
    description: 'Custom and managed container image builds.',
    owner: 'container-images',
    defaultEnabled: true,
    disablePolicy: 'drain_active',
  },
  'feature.display-virtual': {
    ...permanentRuntimeFlag,
    description: 'Experimental virtual display sessions.',
    owner: 'display',
    defaultEnabled: false,
    disablePolicy: 'drain_active',
  },
  'feature.ai': {
    ...permanentRuntimeFlag,
    description: 'AI providers, device-agent tasks, and workflow drafting.',
    owner: 'automations',
    defaultEnabled: false,
    disablePolicy: 'block_new',
  },
  'feature.workflows': {
    ...permanentRuntimeFlag,
    description: 'Workflow editing, manual runs, and scheduled triggers.',
    owner: 'automations',
    defaultEnabled: true,
    disablePolicy: 'drain_active',
  },
  'feature.resource-quota': {
    ...permanentRuntimeFlag,
    description: 'Per-user open app, CPU, memory, and session limits.',
    owner: 'android-apps',
    defaultEnabled: true,
    disablePolicy: 'block_new',
  },
  'feature.display-webrtc': {
    ...permanentRuntimeFlag,
    description: 'Live viewer streaming over WebRTC.',
    owner: 'display',
    defaultEnabled: true,
    disablePolicy: 'drain_active',
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
