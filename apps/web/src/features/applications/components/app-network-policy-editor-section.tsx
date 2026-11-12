import type { ReactNode } from 'react'
import { FormField } from '@/components/ui/form-field'
import { Section } from '@/components/ui/section'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  approvedDestinationsLabel,
  managedDestinationsDescription,
  outboundAccessLabel,
  unrestrictedAccessLabel
} from '@/shared/model/network/outbound-policy'

type AppNetworkPolicyEditorSectionProps = {
  restricted: boolean
  onRestrictedChange: (enabled: boolean) => void
  destinations: string
  onDestinationsChange: (text: string) => void
  canUseInternet: boolean
  disabled?: boolean
  modeError?: string
  destinationsError?: string
  children?: ReactNode
}

export const AppNetworkPolicyEditorSection = ({
  restricted,
  onRestrictedChange,
  destinations,
  onDestinationsChange,
  canUseInternet,
  disabled,
  modeError,
  destinationsError,
  children
}: AppNetworkPolicyEditorSectionProps) => {
  return (
    <Section
      title='Network access'
      surface='plain'
      contentClassName='gap-5'
    >
      <FormField
        label='Outbound access'
        error={modeError}
        description={
          restricted
            ? 'Allow managed destinations and any IPv4 destinations you add.'
            : 'Allow all outbound destinations.'
        }
        layout='vertical'
      >
        <Select
          value={restricted ? 'approved' : 'unrestricted'}
          disabled={disabled}
          onValueChange={value => onRestrictedChange(value === 'approved')}
        >
          <SelectTrigger className='w-full sm:max-w-sm'>
            <SelectValue>{outboundAccessLabel(restricted)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='approved'>{approvedDestinationsLabel}</SelectItem>
            <SelectItem
              value='unrestricted'
              disabled={!canUseInternet}
            >
              {unrestrictedAccessLabel}
            </SelectItem>
          </SelectContent>
        </Select>
      </FormField>
      {restricted ? (
        <>
          <div className='grid gap-1 text-sm'>
            <p className='font-medium'>Managed destinations</p>
            <p className='text-foreground-muted'>{managedDestinationsDescription}</p>
          </div>
          <FormField
            label='Additional IPv4 destinations'
            description='Enter one IPv4 address or CIDR range per line, such as 10.20.0.0/16. You can also paste a comma-separated list.'
            error={destinationsError}
            layout='vertical'
          >
            <Textarea
              className='font-mono'
              rows={4}
              spellCheck={false}
              autoCapitalize='none'
              placeholder='No additional destinations'
              value={destinations}
              disabled={disabled}
              onChange={event => onDestinationsChange(event.target.value)}
            />
          </FormField>
        </>
      ) : null}
      {children}
    </Section>
  )
}
