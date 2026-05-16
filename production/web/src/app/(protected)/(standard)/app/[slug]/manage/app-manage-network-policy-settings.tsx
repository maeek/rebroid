import { useEffect, useRef, useState } from 'react'
import { Setting } from '@/app/(protected)/_components/settings/setting'
import { NetworkAccessInput } from '@/app/(protected)/_components/viewer/app-info/network-access-input'
import { Button } from '@/components/ui/button'
import { Section } from '@/components/ui/section'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/hooks/use-toast'
import { applyNetworkPolicyAction, updateNetworkPolicyAction } from '@/lib/orchestrator/actions'
import { mapAndroidApplicationToAppDefinition } from '@/lib/orchestrator/app-mapper'
import type { AppDefinition } from '@/app/(protected)/(standard)/constants'

type AppManageNetworkPolicySettingsProps = {
  app: AppDefinition
  onUpdated: (app: AppDefinition) => void
}

const verticalSettingClassName = 'flex-col items-start w-full'

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

  const handleInvalidNetworkPolicyCidr = (value: string) => {
    toast({
      title: 'Invalid CIDR',
      description: `${value} is not a valid IPv4 address or CIDR range.`,
      variant: 'destructive'
    })
  }

  return (
    <Section
      title='Network policy'
      boxed
      titleClassName='pb-4'
      contentClassName='gap-4'
    >
      {app.networkPolicyMessage && <p className='text-sm text-secondary-foreground'>{app.networkPolicyMessage}</p>}
      <Setting
        label='Outbound access'
        description='Limit Android traffic to the API plus any CIDR ranges explicitly added below.'
        className={verticalSettingClassName}
        variant='vertical'
      >
        <Select
          value={networkPolicyEnabled ? 'enabled' : 'disabled'}
          onValueChange={value => {
            isDirtyRef.current = true
            setNetworkPolicyEnabled(value === 'enabled')
          }}
        >
          <SelectTrigger className='w-full'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='enabled'>Only API plus allowlist</SelectItem>
            <SelectItem value='disabled'>Disabled</SelectItem>
          </SelectContent>
        </Select>
      </Setting>
      <div className='flex w-full flex-col gap-3'>
        <NetworkAccessInput
          cidrs={networkPolicyAllowCidrs}
          disabled={isSaving}
          isBusy={isSaving}
          onAddCidr={handleAddNetworkPolicyCidr}
          onRemoveCidr={handleRemoveNetworkPolicyCidr}
          onInvalidCidr={handleInvalidNetworkPolicyCidr}
        />
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
      </div>
    </Section>
  )
}
