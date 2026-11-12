import { useContext, type ReactNode } from 'react'
import { FormField } from '@/components/ui/form-field'
import { FormLoadingContext } from '@/components/ui/form-loading-boundary'
import { Section } from '@/components/ui/section'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton, SkeletonMask } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import {
  approvedDestinationsLabel,
  managedDestinationsDescription,
  outboundAccessLabel,
  unrestrictedAccessLabel
} from '@/shared/model/network/outbound-policy'

type AppNetworkPolicyEditorSectionProps = {
  restricted?: boolean
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
  const loading = useContext(FormLoadingContext)
  const mode = restricted ? 'approved' : 'unrestricted'
  const modeDescription = restricted
    ? 'Allow managed destinations and any IPv4 destinations you add.'
    : 'Allow all outbound destinations.'
  const mask = (text: string) => (loading ? <SkeletonMask>{text}</SkeletonMask> : text)

  return (
    <Section
      title='Network access'
      surface='plain'
      contentClassName='gap-5'
    >
      <FormField
        label='Outbound access'
        error={modeError}
        layout='vertical'
        description={
          loading ? (
            <Skeleton
              as='span'
              className='inline-block h-3 w-64 max-w-full'
            />
          ) : (
            modeDescription
          )
        }
      >
        <Select
          value={loading ? undefined : mode}
          disabled={disabled}
          onValueChange={value => onRestrictedChange(value === 'approved')}
        >
          <SelectTrigger className='w-full sm:max-w-sm'>
            <SelectValue>{!loading && outboundAccessLabel(Boolean(restricted))}</SelectValue>
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
      {restricted || loading ? (
        <>
          <div className='grid gap-1 text-sm'>
            <p className='font-medium'>{mask('Managed destinations')}</p>
            <p className='text-foreground-muted'>{mask(managedDestinationsDescription)}</p>
          </div>
          <FormField
            label={mask('Additional IPv4 destinations')}
            description={mask(
              'Enter one IPv4 address or CIDR range per line, such as 10.20.0.0/16. You can also paste a comma-separated list.'
            )}
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
