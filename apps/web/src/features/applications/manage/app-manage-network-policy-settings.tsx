'use client'

import { useEffect, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Visible } from '@/components/ui/visible'
import { getInvalidCidrMessage } from '@/features/applications/components/app-form-utils'
import { AppNetworkPolicyEditorSection } from '@/features/applications/components/app-network-policy-editor-section'
import { mapAndroidApplicationToAppDefinition } from '@/features/applications/domain/app-mapper'
import { toast } from '@/hooks/use-toast'
import { formatDateLocale } from '@/lib/format'
import {
  applyNetworkPolicyAction,
  updateNetworkPolicyAction
} from '@/server/orchestrator/applications/actions/configuration/network-policy-actions'
import type { AppDefinition } from '@/features/applications/domain/app-definition'

type AppManageNetworkPolicySettingsProps = {
  app: AppDefinition
  onUpdated: (app: AppDefinition) => void
}

const getPolicyStatus = (app: AppDefinition) =>
  app.networkPolicyResult?.status ?? app.networkPolicyStatus ?? 'not applied'

const getPolicyMessage = (app: AppDefinition) =>
  app.networkPolicyResult?.hint ?? app.networkPolicyResult?.message ?? app.networkPolicyMessage

export const AppManageNetworkPolicySettings = ({ app, onUpdated }: AppManageNetworkPolicySettingsProps) => {
  const [networkPolicyEnabled, setNetworkPolicyEnabled] = useState(app.networkPolicyEnabled)
  const [networkPolicyAllowCidrs, setNetworkPolicyAllowCidrs] = useState<string[]>(app.networkPolicyAllowCidrs ?? [])
  const [isSaving, setIsSaving] = useState(false)
  const isDirtyRef = useRef(false)
  const previousAppIdRef = useRef(app.id)

  useEffect(() => {
    if (previousAppIdRef.current !== app.id) {
      previousAppIdRef.current = app.id
      isDirtyRef.current = false
    }

    if (!isDirtyRef.current) {
      setNetworkPolicyEnabled(app.networkPolicyEnabled)
      setNetworkPolicyAllowCidrs(app.networkPolicyAllowCidrs ?? [])
    }
  }, [app])

  const syncFromApp = (nextApp: AppDefinition) => {
    setNetworkPolicyEnabled(nextApp.networkPolicyEnabled)
    setNetworkPolicyAllowCidrs(nextApp.networkPolicyAllowCidrs ?? [])
  }

  const persistNetworkPolicy = async () => {
    const updated = await updateNetworkPolicyAction(app.id, {
      networkPolicyEnabled,
      networkPolicyAllowCidrs
    })
    const mapped = mapAndroidApplicationToAppDefinition(updated)
    onUpdated(mapped)
    syncFromApp(mapped)
    isDirtyRef.current = false
    return mapped
  }

  const handleSaveNetworkPolicy = async () => {
    setIsSaving(true)
    try {
      await persistNetworkPolicy()
      toast({ title: 'Network policy saved' })
    } catch (error) {
      toast({
        title: 'Could not save network policy',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleApplyNetworkPolicy = async () => {
    setIsSaving(true)
    try {
      if (isDirtyRef.current) {
        await persistNetworkPolicy()
      }

      const updated = await applyNetworkPolicyAction(app.id)
      const mapped = mapAndroidApplicationToAppDefinition(updated)
      onUpdated(mapped)
      syncFromApp(mapped)
      toast({ title: 'Network policy applied' })
    } catch (error) {
      toast({
        title: 'Could not apply policy',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleAddNetworkPolicyCidr = (cidr: string) => {
    isDirtyRef.current = true
    setNetworkPolicyAllowCidrs(current => (current.includes(cidr) ? current : [...current, cidr]))
  }

  const handleRemoveNetworkPolicyCidr = (cidr: string) => {
    isDirtyRef.current = true
    setNetworkPolicyAllowCidrs(current => current.filter(entry => entry !== cidr))
  }

  const showInvalidCidrToast = (value: string) => {
    toast({
      title: 'Invalid CIDR',
      description: getInvalidCidrMessage(value),
      variant: 'destructive'
    })
  }

  return (
    <AppNetworkPolicyEditorSection
      title='Network access'
      topSection={
        <div className='flex flex-col gap-2'>
          <div className='flex flex-wrap items-center gap-2'>
            <Badge variant={networkPolicyEnabled ? 'status' : 'secondary'}>
              {networkPolicyEnabled ? 'Restricted' : 'Unrestricted'}
            </Badge>
            <Badge
              variant={app.networkPolicyResult?.status === 'error' ? 'destructive' : 'secondary'}
              className='capitalize'
            >
              {getPolicyStatus(app)}
            </Badge>
            <Visible when={app.networkPolicyAppliedAt}>
              <span className='text-xs text-foreground-muted'>
                Applied {formatDateLocale(app.networkPolicyAppliedAt as Date)}
              </span>
            </Visible>
          </div>
          <Visible when={getPolicyMessage(app)}>
            <p className='text-sm text-foreground-muted'>{getPolicyMessage(app)}</p>
          </Visible>
        </div>
      }
      modeValue={networkPolicyEnabled}
      canEnableUnrestricted
      modeDescription='Choose whether Android traffic is limited to the API and explicit CIDR ranges.'
      onModeChange={value => {
        isDirtyRef.current = true
        setNetworkPolicyEnabled(value)
      }}
      allowCidrs={networkPolicyAllowCidrs}
      onAddCidr={handleAddNetworkPolicyCidr}
      onRemoveCidr={handleRemoveNetworkPolicyCidr}
      onInvalidCidr={showInvalidCidrToast}
      isBusy={isSaving}
      sectionActions={
        <div className='flex gap-2'>
          <Button
            type='button'
            disabled={isSaving}
            onClick={() => void handleSaveNetworkPolicy()}
          >
            Save policy
          </Button>
          <Button
            type='button'
            variant='secondary'
            disabled={isSaving}
            onClick={() => void handleApplyNetworkPolicy()}
          >
            Apply now
          </Button>
        </div>
      }
      restrictedLabel='Only API plus allowlist'
      unrestrictedLabel='Disabled'
    />
  )
}
