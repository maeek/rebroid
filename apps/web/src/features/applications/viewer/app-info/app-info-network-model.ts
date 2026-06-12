import type { AppDefinition } from '@/features/applications/domain/app-definition'

type NetworkPolicyResult = NonNullable<AppDefinition['networkPolicyResult']>

const noPolicyResultDescription = 'The network policy has not been applied yet.'

const policyStatusDescriptions: Partial<Record<NetworkPolicyResult['code'], (result: NetworkPolicyResult) => string>> =
  {
    applied: result =>
      result.hint ?? 'The latest network policy rules were applied successfully to the running container.',
    apply_failed: result =>
      result.hint ?? 'Applying the latest network policy failed. Check the policy details below for more detail.',
    container_ip_unavailable: result =>
      result.hint ?? 'The container is not ready on its network yet, so the policy could not be attached.',
    container_not_created: result =>
      result.hint ?? 'The app must create its managed container before policy rules can be applied.',
    agent_unavailable: result => result.hint ?? 'The firewall agent is unavailable.',
    unsupported_host: result => result.hint ?? 'The host firewall backend is unsupported.',
    policy_disabled: result => result.hint ?? 'Network policy restrictions are disabled for this app.',
    unknown: result => result.message
  }

export const getPolicyEnabledDescription = (enabled: boolean) =>
  enabled
    ? 'Network policy restrictions are enabled for this app and will be enforced when they can be applied.'
    : 'Network policy restrictions are turned off for this app, so outbound access is not limited.'

export const getPolicyStatusDescription = (result?: AppDefinition['networkPolicyResult']) => {
  if (!result) {
    return noPolicyResultDescription
  }

  return policyStatusDescriptions[result.code]?.(result) ?? noPolicyResultDescription
}

export const getPolicyStatusText = (app: AppDefinition) =>
  app.networkPolicyResult?.status ?? app.networkPolicyStatus ?? 'not applied'

export const getPolicyAppliedAt = (app: AppDefinition) => app.networkPolicyAppliedAt ?? undefined

export const getPolicyHint = (app: AppDefinition) => app.networkPolicyResult?.hint ?? undefined

export const getPolicyMessage = (app: AppDefinition) =>
  app.networkPolicyResult?.message ?? app.networkPolicyMessage ?? undefined

export const getAppAllowCidrs = (app?: AppDefinition) => app?.networkPolicyAllowCidrs ?? []

export const getAppId = (app?: AppDefinition) => app?.id

export const isNetworkAccessDisabled = (app?: AppDefinition) => !app

export const adbAddressForApp = (app: AppDefinition) => `${app.containerName}:${app.adbPort}`
