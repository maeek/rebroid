import { allowsBroadInternetAccess } from '@rebroid/firewall-policy-core/policy'
import { Section } from '@/components/ui/section'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { NetworkAccessInput } from '@/features/applications/viewer/app-info/network-access-input'
import { Setting } from '@/features/settings/components/setting'
import { toast } from '@/hooks/use-toast'
import type { CreateAppFormValues } from './create-app-form.types'

type CreateAppNetworkAccessSectionProps = {
  values: CreateAppFormValues
  canUseInternet: boolean
  onChange: (patch: Partial<CreateAppFormValues>) => void
}

const verticalSettingClassName = 'flex-col items-start w-full'

export const CreateAppNetworkAccessSection = ({
  values,
  canUseInternet,
  onChange
}: CreateAppNetworkAccessSectionProps) => {
  const handleAddCidr = (cidr: string) => {
    const nextCidrs = values.networkPolicyAllowCidrs.includes(cidr)
      ? values.networkPolicyAllowCidrs
      : [...values.networkPolicyAllowCidrs, cidr]

    if (!canUseInternet && allowsBroadInternetAccess(nextCidrs)) {
      toast({
        title: 'Broad internet access is restricted',
        description: 'Add a narrower app-specific IPv4 range.',
        variant: 'destructive'
      })
      return
    }

    onChange({ networkPolicyAllowCidrs: nextCidrs })
  }

  const handleRemoveCidr = (cidr: string) => {
    onChange({ networkPolicyAllowCidrs: values.networkPolicyAllowCidrs.filter(entry => entry !== cidr) })
  }

  const handleInvalidCidr = (value: string) => {
    toast({
      title: 'Invalid CIDR',
      description: `${value} is not a valid IPv4 address or CIDR range.`,
      variant: 'destructive'
    })
  }

  return (
    <Section
      title='Network access'
      boxed
      titleClassName='pb-4'
      contentClassName='gap-5'
    >
      <p className='text-sm text-secondary-foreground'>
        Choose outbound access before the app is provisioned. API/default destinations are applied automatically.
      </p>

      <Setting
        label='Mode'
        description='Limit Android traffic to the API and explicit CIDR ranges, or allow unrestricted outbound access.'
        className={verticalSettingClassName}
        variant='vertical'
      >
        <Select
          value={values.networkPolicyEnabled ? 'enabled' : 'disabled'}
          onValueChange={value => onChange({ networkPolicyEnabled: value === 'enabled' })}
        >
          <SelectTrigger className='w-full'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='enabled'>Only API plus allowlist</SelectItem>
            <SelectItem
              value='disabled'
              disabled={!canUseInternet}
            >
              Unrestricted outbound access
            </SelectItem>
          </SelectContent>
        </Select>
      </Setting>

      <div className='flex w-full flex-col gap-3'>
        <div className='grid gap-1'>
          <div className='text-sm font-bold text-foreground'>Allowlist</div>
          <p className='text-xs leading-relaxed text-muted-foreground'>Add app-specific IPv4 ranges when needed.</p>
        </div>
        <NetworkAccessInput
          cidrs={values.networkPolicyAllowCidrs}
          disabled={!values.networkPolicyEnabled}
          onAddCidr={handleAddCidr}
          onRemoveCidr={handleRemoveCidr}
          onInvalidCidr={handleInvalidCidr}
        />
      </div>
    </Section>
  )
}
