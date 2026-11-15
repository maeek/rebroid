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
  modified?: { restricted: boolean; destinations: boolean }
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
  modified,
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
      className='@container'
      contentClassName='gap-5'
    >
      <div className='grid items-start gap-4 @min-[42rem]:grid-cols-2 @min-[42rem]:gap-x-form-column'>
        <div className='grid min-w-0 gap-4'>
          <FormField
            label='Outbound access'
            modified={modified?.restricted}
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
              <SelectTrigger className='w-full'>
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
            <div className='grid gap-1 text-sm'>
              <p className='font-medium'>{mask('Managed destinations')}</p>
              <p className='text-foreground-muted'>{mask(managedDestinationsDescription)}</p>
            </div>
          ) : null}
        </div>
        {restricted || loading ? (
          <FormField
            label={mask('Additional IPv4 destinations')}
            modified={modified?.destinations}
            description={mask('Add IPv4 addresses or CIDR ranges, one per line or separated by commas.')}
            error={destinationsError}
            layout='vertical'
          >
            <Textarea
              className='font-mono'
              rows={3}
              spellCheck={false}
              autoCapitalize='none'
              placeholder='10.20.0.0/16'
              value={destinations}
              disabled={disabled}
              onChange={event => onDestinationsChange(event.target.value)}
            />
          </FormField>
        ) : null}
      </div>
      {children}
    </Section>
  )
}
