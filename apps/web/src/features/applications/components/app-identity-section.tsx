import type { ChangeEvent } from 'react'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Section } from '@/components/ui/section'
import { Visible } from '@/components/ui/visible'
import { verticalSettingClassName } from './app-form-utils'

type AppIdentitySectionProps = {
  valuesName: string
  onNameChange: (name: string) => void
  uploadedApkLabel?: string | null
  isUploadingApk: boolean
  onApkSelect: (file: File | null) => void
  iconSlot?: React.ReactNode
  nameDescription?: string
  apkDescription?: string
  nameRequired?: boolean
  nameLabel?: string
  nameMinLength?: number
  surface?: 'plain' | 'band' | 'panel'
}

export const AppIdentitySection = ({
  valuesName,
  onNameChange,
  uploadedApkLabel,
  isUploadingApk,
  onApkSelect,
  iconSlot,
  nameDescription = 'Display name shown in the UI for this app. Minimum 2 characters.',
  apkDescription = 'Optional Android package. It uploads first so metadata and icons can be extracted before the app is created.',
  nameRequired = true,
  nameLabel = 'Name',
  nameMinLength = 2,
  surface = 'band'
}: AppIdentitySectionProps) => {
  const handleNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    onNameChange(event.target.value)
  }

  const handleApkSelect = (event: ChangeEvent<HTMLInputElement>) => {
    onApkSelect(event.target.files?.[0] ?? null)
    event.target.value = ''
  }

  return (
    <Section
      title='Application'
      surface={surface}
      headingSpacing='default'
      contentClassName='gap-5'
    >
      <div className='grid gap-5 xl:grid-cols-[max-content_1fr]'>
        <Visible when={iconSlot}>
          <div className='border-surface-border/60 xl:pr-5'>{iconSlot}</div>
        </Visible>
        <div className='flex flex-col gap-6'>
          <FormField
            label={nameLabel}
            description={nameDescription}
            layout='vertical'
            className={verticalSettingClassName}
            required={nameRequired}
          >
            <Input
              value={valuesName}
              required={nameRequired}
              aria-required={nameRequired ? 'true' : 'false'}
              minLength={nameMinLength}
              onChange={handleNameChange}
            />
          </FormField>
          <FormField
            label='APK file'
            description={apkDescription}
            layout='vertical'
            className={verticalSettingClassName}
          >
            <div className='flex w-full flex-col gap-2'>
              <Input
                type='file'
                accept='.apk,application/vnd.android.package-archive'
                disabled={isUploadingApk}
                onChange={handleApkSelect}
              />
              <Visible when={uploadedApkLabel}>
                <p className='text-sm text-foreground-muted'>{uploadedApkLabel}</p>
              </Visible>
            </div>
          </FormField>
        </div>
      </div>
    </Section>
  )
}
