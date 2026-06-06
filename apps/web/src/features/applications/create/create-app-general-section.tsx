import type { ReactNode } from 'react'
import { Input } from '@/components/ui/input'
import { Section } from '@/components/ui/section'
import { Visible } from '@/components/ui/visible'
import { Setting } from '@/features/settings/components/setting'
import type { AppFormValues } from './create-app-form.types'
import type { UploadedApk } from '@/server/orchestrator/applications/types'

type AppFormGeneralSectionProps = {
  values: AppFormValues
  onChange: (patch: Partial<AppFormValues>) => void
  uploadedApk?: UploadedApk | null
  apkLabel?: string | null
  isUploadingApk: boolean
  iconSlot?: ReactNode
  onApkSelect: (file: File | null) => void
}

const verticalSettingClassName = 'flex-col items-start w-full'

export const AppFormGeneralSection = ({
  values,
  onChange,
  uploadedApk,
  apkLabel,
  isUploadingApk,
  iconSlot,
  onApkSelect
}: AppFormGeneralSectionProps) => {
  return (
    <Section
      title='Application'
      titleClassName='pb-4'
      contentClassName='gap-5'
    >
      <div className='grid gap-5 xl:grid-cols-[max-content_1fr]'>
        <Visible when={iconSlot}>
          <div className='border-border/60 xl:pr-5'>{iconSlot}</div>
        </Visible>
        <div className='flex flex-col gap-6'>
          <Setting
            label='Name'
            description='Display name shown in the UI for this app. Minimum 2 characters.'
            variant='vertical'
            className={verticalSettingClassName}
            required
          >
            <Input
              value={values.name}
              required
              aria-required='true'
              minLength={2}
              onChange={event => onChange({ name: event.target.value })}
            />
          </Setting>
          <Setting
            label='APK file'
            description='Optional Android package. It uploads first so metadata and icons can be extracted before the app is created.'
            variant='vertical'
            className={verticalSettingClassName}
          >
            <div className='flex w-full flex-col gap-2'>
              <Input
                type='file'
                accept='.apk,application/vnd.android.package-archive'
                disabled={isUploadingApk}
                onChange={event => {
                  onApkSelect(event.target.files?.[0] ?? null)
                  event.target.value = ''
                }}
              />
              <Visible when={uploadedApk || apkLabel}>
                <p className='text-sm text-secondary-foreground'>
                  {uploadedApk
                    ? `Uploaded ${uploadedApk.originalName} · ${(uploadedApk.sizeBytes / 1024 / 1024).toFixed(2)} MB`
                    : apkLabel}
                </p>
              </Visible>
            </div>
          </Setting>
        </div>
      </div>
    </Section>
  )
}
