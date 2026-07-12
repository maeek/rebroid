import { ReactNode } from 'react'
import { FormField } from '@/components/ui/form-field'
import { Section } from '@/components/ui/section'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Visible } from '@/components/ui/visible'
import { NetworkAccessInput } from '@/features/applications/viewer/app-info/network-access-input'
import { verticalSettingClassName } from './app-form-utils'

type AppNetworkPolicyEditorSectionProps = {
  title: string
  modeValue: boolean
  onModeChange: (enabled: boolean) => void
  allowCidrs: string[]
  onAddCidr: (cidr: string) => void
  onRemoveCidr: (cidr: string) => void
  onInvalidCidr: (value: string) => void
  isBusy?: boolean
  canEnableUnrestricted?: boolean
  modeDescription?: string
  allowlistTitle?: string
  allowlistDescription?: string
  sectionDescription?: ReactNode
  sectionActions?: ReactNode
  topSection?: ReactNode
  unrestrictedLabel?: string
  restrictedLabel?: string
  titleClassName?: string
  contentClassName?: string
  surface?: 'plain' | 'band' | 'panel'
}

export const AppNetworkPolicyEditorSection = ({
  title,
  modeValue,
  onModeChange,
  allowCidrs,
  onAddCidr,
  onRemoveCidr,
  onInvalidCidr,
  isBusy,
  canEnableUnrestricted = true,
  modeDescription = 'Limit Android traffic to the API and explicit CIDR ranges.',
  allowlistTitle = 'Allowlist',
  allowlistDescription = 'Add app-specific IPv4 ranges when needed.',
  sectionDescription,
  sectionActions,
  topSection,
  unrestrictedLabel = 'Disabled',
  restrictedLabel = 'Only API plus allowlist',
  titleClassName = 'pb-4',
  contentClassName = 'gap-5',
  surface = 'band'
}: AppNetworkPolicyEditorSectionProps) => {
  return (
    <Section
      title={title}
      surface={surface}
      titleClassName={titleClassName}
      contentClassName={contentClassName}
    >
      <Visible when={sectionDescription}>
        <p className='text-sm text-foreground-muted'>{sectionDescription}</p>
      </Visible>
      <Visible when={topSection}>{topSection}</Visible>
      <FormField
        label='Mode'
        description={modeDescription}
        className={verticalSettingClassName}
        layout='vertical'
      >
        <Select
          value={modeValue ? 'enabled' : 'disabled'}
          onValueChange={value => onModeChange(value === 'enabled')}
        >
          <SelectTrigger className='w-full'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='enabled'>{restrictedLabel}</SelectItem>
            <SelectItem
              value='disabled'
              disabled={!canEnableUnrestricted}
            >
              {unrestrictedLabel}
            </SelectItem>
          </SelectContent>
        </Select>
      </FormField>
      <div className='flex w-full flex-col gap-3'>
        <div className='grid gap-1'>
          <div className='text-sm font-bold text-foreground'>{allowlistTitle}</div>
          <p className='text-xs leading-relaxed text-foreground-muted'>{allowlistDescription}</p>
        </div>
        <NetworkAccessInput
          cidrs={allowCidrs}
          disabled={isBusy}
          isBusy={isBusy}
          onAddCidr={onAddCidr}
          onRemoveCidr={onRemoveCidr}
          onInvalidCidr={onInvalidCidr}
        />
      </div>
      <Visible when={sectionActions}>
        <div className='flex gap-2'>{sectionActions}</div>
      </Visible>
    </Section>
  )
}
