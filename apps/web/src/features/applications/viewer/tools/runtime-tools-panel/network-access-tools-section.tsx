'use client'

import { useEffect, useRef, useState } from 'react'
import { allowsBroadInternetAccess } from '@rebroid/firewall-policy-core/policy'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { mapAndroidApplicationToAppDefinition } from '@/features/applications/domain/app-mapper'
import { NetworkAccessInput } from '@/features/applications/viewer/app-info/network-access-input'
import { toast } from '@/hooks/use-toast'
import { updateNetworkPolicyAction } from '@/server/orchestrator/applications/actions/configuration/network-policy-actions'
import { hasPermission } from '@/shared/permissions/permissions'
import { ToolSection } from './tool-section'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { PermissionMap } from '@/shared/permissions/permissions'

export const NetworkAccessToolsSection = ({
  app,
  permissions,
  onAppChange,
  className,
  hideHeader
}: {
  app: AppDefinition
  permissions: PermissionMap
  onAppChange: (app: AppDefinition) => void
  className?: string
  hideHeader?: boolean
}) => {
  const [allowCidrs, setAllowCidrs] = useState(app.networkPolicyAllowCidrs)
  const [isSaving, setIsSaving] = useState(false)
  const pendingChangesRef = useRef(false)
  const previousAppIdRef = useRef(app.id)
  const canUseInternet = hasPermission(permissions, 'applications:use-internet')

  useEffect(() => {
    if (previousAppIdRef.current !== app.id) {
      previousAppIdRef.current = app.id
      pendingChangesRef.current = false
    }

    if (!pendingChangesRef.current) {
      setAllowCidrs(app.networkPolicyAllowCidrs)
    }
  }, [app.id, app.networkPolicyAllowCidrs])

  const persistNetworkPolicy = async (networkPolicyEnabled: boolean, nextCidrs: string[]) => {
    const previousCidrs = allowCidrs
    pendingChangesRef.current = true
    setAllowCidrs(nextCidrs)
    setIsSaving(true)

    try {
      const updated = await updateNetworkPolicyAction(app.id, {
        networkPolicyEnabled,
        networkPolicyAllowCidrs: nextCidrs
      })
      const mapped = mapAndroidApplicationToAppDefinition(updated)
      pendingChangesRef.current = false
      setAllowCidrs(mapped.networkPolicyAllowCidrs)
      onAppChange(mapped)
    } catch (error) {
      pendingChangesRef.current = false
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

  const handleRestrictionChange = (enabled: boolean) => {
    if (!enabled && !canUseInternet) {
      return
    }

    void persistNetworkPolicy(enabled, allowCidrs)
  }

  const handleAddCidr = (cidr: string) => {
    const nextCidrs = [...allowCidrs, cidr]
    if (!canUseInternet && allowsBroadInternetAccess(nextCidrs)) {
      toast({
        title: 'Broad internet access is not allowed',
        description: 'You do not have permission to add an unrestricted outbound range.',
        variant: 'destructive'
      })
      return
    }

    void persistNetworkPolicy(app.networkPolicyEnabled, nextCidrs)
  }

  const handleRemoveCidr = (cidr: string) => {
    void persistNetworkPolicy(
      app.networkPolicyEnabled,
      allowCidrs.filter(entry => entry !== cidr)
    )
  }

  return (
    <ToolSection
      title='Network access'
      description='Adjust outbound restrictions while using the viewer.'
      className={className}
      hideHeader={hideHeader}
    >
      <div className='flex flex-col gap-4'>
        <div className='flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/70 bg-surface-band/40 px-3 py-3'>
          <div className='min-w-0'>
            <div className='flex flex-wrap items-center gap-2'>
              <p className='text-sm font-medium'>Restrict outbound access</p>
              <Badge variant={app.networkPolicyEnabled ? 'status' : 'secondary'}>
                {app.networkPolicyEnabled ? 'Enabled' : 'Disabled'}
              </Badge>
            </div>
            <p className='mt-1 text-xs text-foreground-muted'>
              {app.networkPolicyEnabled
                ? 'Only API/default destinations and the CIDRs below are allowed.'
                : 'Restrictions are disabled. The app can access any outbound destination.'}
            </p>
          </div>
          <Switch
            checked={app.networkPolicyEnabled}
            disabled={isSaving || (app.networkPolicyEnabled && !canUseInternet)}
            onCheckedChange={handleRestrictionChange}
            aria-label='Restrict outbound access'
          />
        </div>
        {!canUseInternet ? (
          <p className='text-xs text-muted-foreground'>
            Your permissions allow allowlist edits, but not disabling restrictions or adding broad internet ranges.
          </p>
        ) : null}
        <NetworkAccessInput
          cidrs={allowCidrs}
          disabled={isSaving}
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
      </div>
    </ToolSection>
  )
}
