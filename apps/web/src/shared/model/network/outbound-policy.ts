import type { AndroidApplication } from '@/shared/contracts/application'

export const approvedDestinationsLabel = 'Approved destinations only'
export const unrestrictedAccessLabel = 'Unrestricted'

export const outboundAccessLabel = (restricted: boolean) =>
  restricted ? approvedDestinationsLabel : unrestrictedAccessLabel

export const managedDestinationsDescription =
  'Rebroid includes the API, display sidecar, and platform defaults automatically.'

const enforcementStates = {
  enforced: {
    label: 'Enforced',
    tone: 'success',
    description: 'The firewall reported that the saved policy is active.'
  },
  unrestricted: {
    label: 'No app restriction',
    tone: 'neutral',
    description: 'The saved policy allows all outbound destinations.'
  },
  nextStart: {
    label: 'On next start',
    tone: 'neutral',
    description: 'The saved policy takes effect when the app starts.'
  },
  starting: { label: 'Starting', tone: 'neutral', description: 'Enforcement is checked as the app starts.' },
  inactive: { label: 'Inactive', tone: 'neutral', description: 'The app is being removed or has been removed.' },
  unverified: {
    label: 'Unverified',
    tone: 'warning',
    description: 'The firewall has yet to confirm the saved policy for this runtime.'
  },
  failed: {
    label: 'Needs attention',
    tone: 'danger',
    description: 'The firewall could not enforce the saved policy. Check firewall health before retrying.'
  }
} as const

export const outboundEnforcement = (
  runtime: AndroidApplication['status']['currentStatus'],
  { enabled, result }: Pick<AndroidApplication['network']['policy'], 'enabled' | 'result'>
) => {
  if (runtime === 'removing' || runtime === 'removed') return enforcementStates.inactive
  if (result?.status === 'error') return enforcementStates.failed
  if (runtime === 'provisioning') return enforcementStates.starting
  if (runtime === 'stopped') return enabled ? enforcementStates.nextStart : enforcementStates.unrestricted
  if (runtime === 'running') {
    if (enabled && result?.status === 'applied') return enforcementStates.enforced
    if (!enabled && result?.code === 'policy_disabled') return enforcementStates.unrestricted
  }
  return enforcementStates.unverified
}
