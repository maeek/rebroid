'use client'

import { useEffect, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Section } from '@/components/ui/section'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Visible } from '@/components/ui/visible'
import { toast } from '@/hooks/use-toast'
import { mapAndroidApplicationToAppDefinition } from '@/lib/orchestrator/app-mapper'
import { updateNetworkPolicyAction } from '@/server/orchestrator/applications/mutation-actions'
import { AppInfoRow } from './app-info-row'
import { NetworkAccessInput } from './network-access-input'
import type { AppDefinition } from '@/app/(protected)/(standard)/constants'

const getPolicyEnabledDescription = (enabled: boolean) => {
  return enabled
    ? 'Network policy restrictions are enabled for this app and will be enforced when they can be applied.'
    : 'Network policy restrictions are turned off for this app, so outbound access is not limited.'
}

const getPolicyStatusDescription = (result?: AppDefinition['networkPolicyResult']) => {
  switch (result?.code) {
    case 'applied':
      return result.hint ?? 'The latest network policy rules were applied successfully to the running container.'
    case 'apply_failed':
      return result.hint ?? 'Applying the latest network policy failed. Check the policy details below for more detail.'
    case 'container_ip_unavailable':
      return result.hint ?? 'The container is not ready on its network yet, so the policy could not be attached.'
    case 'container_not_created':
      return result.hint ?? 'The app must create its managed container before policy rules can be applied.'
    case 'iptables_disabled':
      return result.hint ?? 'Policy enforcement is disabled on the host.'
    case 'policy_disabled':
      return result.hint ?? 'Network policy restrictions are disabled for this app.'
    case 'unknown':
      return result.message
    default:
      return 'The network policy has not been applied yet.'
  }
}

type AppInfoNetworkSectionProps = {
  app?: AppDefinition
  onAppChange: (app: AppDefinition) => void
}

export const AppInfoNetworkSection = ({ app, onAppChange }: AppInfoNetworkSectionProps) => {
  const [allowCidrs, setAllowCidrs] = useState<string[]>(app?.networkPolicyAllowCidrs ?? [])
  const [isSaving, setIsSaving] = useState(false)
  const hasPendingLocalChangesRef = useRef(false)
  const previousAppIdRef = useRef(app?.id)

  useEffect(() => {
    if (app?.id !== previousAppIdRef.current) {
      previousAppIdRef.current = app?.id
      hasPendingLocalChangesRef.current = false
    }

    if (!hasPendingLocalChangesRef.current) {
      setAllowCidrs(app?.networkPolicyAllowCidrs ?? [])
    }
  }, [app?.id, app?.networkPolicyAllowCidrs])

  const persistAllowCidrs = async (nextCidrs: string[]) => {
    if (!app) {
      return
    }

    const previousCidrs = allowCidrs
    hasPendingLocalChangesRef.current = true
    setAllowCidrs(nextCidrs)
    setIsSaving(true)

    try {
      const updated = await updateNetworkPolicyAction(app.id, {
        networkPolicyEnabled: app.networkPolicyEnabled,
        networkPolicyAllowCidrs: nextCidrs
      })
      const mapped = mapAndroidApplicationToAppDefinition(updated)
      hasPendingLocalChangesRef.current = false
      setAllowCidrs(mapped.networkPolicyAllowCidrs)
      onAppChange(mapped)
    } catch (error) {
      hasPendingLocalChangesRef.current = false
      setAllowCidrs(previousCidrs)
      toast({
        title: 'Could not update network access',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleAddCidr = (cidr: string) => {
    void persistAllowCidrs([...allowCidrs, cidr])
  }

  const handleRemoveCidr = (cidr: string) => {
    void persistAllowCidrs(allowCidrs.filter(entry => entry !== cidr))
  }

  return (
    <Section
      title='Network'
      boxed
      titleClassName='pb-4'
      contentClassName='flex-col'
    >
      <AppInfoRow
        label='Network'
        value={app?.networkName || 'Loading...'}
        copyValue={app?.networkName}
      />
      <AppInfoRow
        label='Policy'
        value={
          app ? (
            <div className='flex flex-wrap items-center justify-end gap-2'>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Badge
                      variant={app.networkPolicyEnabled ? 'status' : 'secondary'}
                      className='capitalize'
                    >
                      {app.networkPolicyEnabled ? 'enabled' : 'disabled'}
                    </Badge>
                  </span>
                </TooltipTrigger>
                <TooltipContent>{getPolicyEnabledDescription(app.networkPolicyEnabled)}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Badge
                      variant={app.networkPolicyResult?.status === 'error' ? 'destructive' : 'secondary'}
                      className='capitalize'
                    >
                      {app.networkPolicyResult?.status ?? app.networkPolicyStatus ?? 'not applied'}
                    </Badge>
                  </span>
                </TooltipTrigger>
                <TooltipContent>{getPolicyStatusDescription(app.networkPolicyResult)}</TooltipContent>
              </Tooltip>
            </div>
          ) : (
            'Loading...'
          )
        }
      />
      <AppInfoRow
        label='Network access'
        value={
          <NetworkAccessInput
            cidrs={allowCidrs}
            disabled={!app}
            isBusy={isSaving}
            onAddCidr={handleAddCidr}
            onRemoveCidr={handleRemoveCidr}
            onInvalidCidr={value =>
              toast({
                title: 'Invalid CIDR',
                description: `${value} is not a valid IPv4 address or CIDR range.`,
                variant: 'destructive'
              })
            }
          />
        }
        valueClassName='w-full sm:max-w-none sm:justify-stretch sm:text-left'
      />
      <AppInfoRow
        label='ADB'
        value={app ? `${app.containerName}:${app.adbPort}` : 'Loading...'}
        copyValue={app ? `${app.containerName}:${app.adbPort}` : undefined}
      />
      <AppInfoRow
        label='Transport'
        value={app?.scrcpyTransport || 'Loading...'}
      />
      <AppInfoRow
        label='Applied'
        value={app?.networkPolicyAppliedAt ? app.networkPolicyAppliedAt.toLocaleString() : 'Not applied'}
      />
      <Visible when={app?.networkPolicyResult?.hint}>
        <AppInfoRow
          label='Policy hint'
          value={app?.networkPolicyResult?.hint ?? ''}
        />
      </Visible>
      <Visible when={app?.networkPolicyResult?.message ?? app?.networkPolicyMessage}>
        <AppInfoRow
          label='Policy message'
          value={app?.networkPolicyResult?.message ?? app?.networkPolicyMessage ?? 'Unknown policy state'}
        />
      </Visible>
    </Section>
  )
}
