import { allowsBroadInternetAccess } from '@rebroid/firewall-policy-core/policy'
import { getInvalidCidrMessage } from '@/features/applications/components/app-form-utils'
import { AppNetworkPolicyEditorSection } from '@/features/applications/components/app-network-policy-editor-section'
import { toast } from '@/hooks/use-toast'
import type { CreateAppFormValues } from './create-app-form.types'

type CreateAppNetworkAccessSectionProps = {
  values: CreateAppFormValues
  canUseInternet: boolean
  onChange: (patch: Partial<CreateAppFormValues>) => void
}

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
      description: getInvalidCidrMessage(value),
      variant: 'destructive'
    })
  }

  return (
    <AppNetworkPolicyEditorSection
      title='Network access'
      surface='plain'
      sectionDescription='Choose outbound access before the app is provisioned. API/default destinations are applied automatically.'
      modeDescription='Limit Android traffic to the API and explicit CIDR ranges, or allow unrestricted outbound access.'
      unrestrictedLabel='Unrestricted outbound access'
      modeValue={values.networkPolicyEnabled}
      onModeChange={value => onChange({ networkPolicyEnabled: value })}
      canEnableUnrestricted={canUseInternet}
      allowCidrs={values.networkPolicyAllowCidrs}
      onAddCidr={handleAddCidr}
      onRemoveCidr={handleRemoveCidr}
      onInvalidCidr={handleInvalidCidr}
    />
  )
}
