'use client'

import { useEffect, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Section } from '@/components/ui/section'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Visible } from '@/components/ui/visible'
import { mapAndroidApplicationToAppDefinition } from '@/features/applications/domain/app-mapper'
import { toast } from '@/hooks/use-toast'
import { formatDateLocale } from '@/lib/format'
import { updateNetworkPolicyAction } from '@/server/orchestrator/applications/actions/configuration/network-policy-actions'
import {
  adbAddressForApp,
  getAppAllowCidrs,
  getAppId,
  getPolicyAppliedAt,
  getPolicyEnabledDescription,
  getPolicyHint,
  getPolicyMessage,
  getPolicyStatusDescription,
  getPolicyStatusText,
  isNetworkAccessDisabled
} from './app-info-network-model'
import { AppInfoRow } from './app-info-row'
import { NetworkAccessInput } from './network-access-input'
import type { AppDefinition } from '@/features/applications/domain/app-definition'

type AppInfoNetworkSectionProps = {
  app?: AppDefinition
  canConfigureEgress: boolean
  canViewBackendDetails: boolean
  onAppChange: (app: AppDefinition) => void
}

const NetworkPolicyEnabledBadge = ({ enabled }: { enabled: boolean }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <span>
        <Badge
          variant={enabled ? 'status' : 'secondary'}
          className='capitalize'
        >
          {enabled ? 'enabled' : 'disabled'}
        </Badge>
      </span>
    </TooltipTrigger>
    <TooltipContent>{getPolicyEnabledDescription(enabled)}</TooltipContent>
  </Tooltip>
)

const NetworkPolicyStatusBadge = ({ app }: { app: AppDefinition }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <span>
        <Badge
          variant={app.networkPolicyResult?.status === 'error' ? 'destructive' : 'secondary'}
          className='capitalize'
        >
          {getPolicyStatusText(app)}
        </Badge>
      </span>
    </TooltipTrigger>
    <TooltipContent>{getPolicyStatusDescription(app.networkPolicyResult)}</TooltipContent>
  </Tooltip>
)

const NetworkPolicyBadges = ({ app }: { app?: AppDefinition }) => {
  if (!app) {
    return <>Loading...</>
  }

  return (
    <div className='flex flex-wrap items-center justify-end gap-2'>
      <NetworkPolicyEnabledBadge enabled={app.networkPolicyEnabled} />
      <NetworkPolicyStatusBadge app={app} />
    </div>
  )
}

const NetworkNameRow = ({ app }: { app?: AppDefinition }) => {
  if (!app) {
    return (
      <AppInfoRow
        label='Network'
        value='Loading...'
      />
    )
  }

  return (
    <AppInfoRow
      label='Network'
      value={app.networkName}
      copyValue={app.networkName}
    />
  )
}

const NetworkConnectionRows = ({ app }: { app?: AppDefinition }) => {
  if (!app) {
    return (
      <>
        <AppInfoRow
          label='ADB'
          value='Loading...'
        />
        <AppInfoRow
          label='Transport'
          value='Loading...'
        />
      </>
    )
  }

  const adbAddress = adbAddressForApp(app)

  return (
    <>
      <AppInfoRow
        label='ADB'
        value={adbAddress}
        copyValue={adbAddress}
      />
      <AppInfoRow
        label='Transport'
        value={app.scrcpyTransport}
      />
    </>
  )
}

const PolicyAppliedRow = ({ appliedAt }: { appliedAt?: Date | string }) => (
  <AppInfoRow
    label='Applied'
    value={appliedAt ? formatDateLocale(appliedAt) : 'Not applied'}
  />
)

const PolicyHintRow = ({ hint }: { hint?: string }) => (
  <Visible when={hint}>
    <AppInfoRow
      label='Policy hint'
      value={hint}
    />
  </Visible>
)

const PolicyMessageRow = ({ message }: { message?: string }) => (
  <Visible when={message}>
    <AppInfoRow
      label='Policy message'
      value={message}
    />
  </Visible>
)

const PolicyResultRows = ({ app }: { app?: AppDefinition }) => {
  if (!app) {
    return <PolicyAppliedRow />
  }

  return (
    <>
      <PolicyAppliedRow appliedAt={getPolicyAppliedAt(app)} />
      <PolicyHintRow hint={getPolicyHint(app)} />
      <PolicyMessageRow message={getPolicyMessage(app)} />
    </>
  )
}

const showInvalidCidrToast = (value: string) => {
  toast({
    title: 'Invalid CIDR',
    description: `${value} is not a valid IPv4 address or CIDR range.`,
    variant: 'destructive'
  })
}

export const AppInfoNetworkSection = ({
  app,
  canConfigureEgress,
  canViewBackendDetails,
  onAppChange
}: AppInfoNetworkSectionProps) => {
  const appId = getAppId(app)
  const [allowCidrs, setAllowCidrs] = useState<string[]>(() => getAppAllowCidrs(app))
  const [isSaving, setIsSaving] = useState(false)
  const hasPendingLocalChangesRef = useRef(false)
  const previousAppIdRef = useRef(appId)

  useEffect(() => {
    if (appId !== previousAppIdRef.current) {
      previousAppIdRef.current = appId
      hasPendingLocalChangesRef.current = false
    }

    if (!hasPendingLocalChangesRef.current) {
      setAllowCidrs(getAppAllowCidrs(app))
    }
  }, [app, appId])

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
      titleClassName='pb-4'
      contentClassName='flex-col'
    >
      <Visible when={canViewBackendDetails}>
        <NetworkNameRow app={app} />
      </Visible>
      <AppInfoRow
        label='Policy'
        value={<NetworkPolicyBadges app={app} />}
      />
      <Visible when={canConfigureEgress}>
        <AppInfoRow
          label='Network access'
          value={
            <NetworkAccessInput
              cidrs={allowCidrs}
              disabled={isNetworkAccessDisabled(app)}
              isBusy={isSaving}
              onAddCidr={handleAddCidr}
              onRemoveCidr={handleRemoveCidr}
              onInvalidCidr={showInvalidCidrToast}
            />
          }
          valueClassName='w-full sm:max-w-none sm:justify-stretch sm:text-left'
        />
      </Visible>
      <Visible when={canViewBackendDetails}>
        <NetworkConnectionRows app={app} />
      </Visible>
      <PolicyResultRows app={app} />
    </Section>
  )
}
