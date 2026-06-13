import type { ChangeEvent } from 'react'
import { Input } from '@/components/ui/input'
import { Section } from '@/components/ui/section'
import { Visible } from '@/components/ui/visible'
import { Setting } from '@/shared/ui/settings/setting'
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
  nameMinLength = 2
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
      surface='band'
      titleClassName='pb-4'
      contentClassName='gap-5'
    >
      <div className='grid gap-5 xl:grid-cols-[max-content_1fr]'>
        <Visible when={iconSlot}>
          <div className='border-border/60 xl:pr-5'>{iconSlot}</div>
        </Visible>
        <div className='flex flex-col gap-6'>
          <Setting
            label={nameLabel}
            description={nameDescription}
            variant='vertical'
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
          </Setting>
          <Setting
            label='APK file'
            description={apkDescription}
            variant='vertical'
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
          </Setting>
        </div>
      </div>
    </Section>
  )
}
