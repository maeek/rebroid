import { Input } from '@/components/ui/input'
import { Section } from '@/components/ui/section'
import { Visible } from '@/components/ui/visible'
import { Setting } from '@/features/settings/components/setting'
import type { CreateAppFormValues } from './create-app-form.types'
import type { UploadedApk } from '@/server/orchestrator/applications/types'

type CreateAppGeneralSectionProps = {
  values: CreateAppFormValues
  onChange: (patch: Partial<CreateAppFormValues>) => void
  uploadedApk: UploadedApk | null
  isUploadingApk: boolean
  onApkSelect: (file: File | null) => void
}

const verticalSettingClassName = 'flex-col items-start w-full'

export const CreateAppGeneralSection = ({
  values,
  onChange,
  uploadedApk,
  isUploadingApk,
  onApkSelect
}: CreateAppGeneralSectionProps) => {
  return (
    <Section
      title='Application'
      boxed
      titleClassName='pb-4'
      contentClassName='gap-4'
    >
      <Setting
        label='Name'
        description='Display name shown in the UI for this app. Minimum 2 characters.'
        variant='vertical'
        className={verticalSettingClassName}
      >
        <Input
          value={values.name}
          required
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
            onChange={event => onApkSelect(event.target.files?.[0] ?? null)}
          />
          <Visible when={uploadedApk}>
            <p className='text-sm text-secondary-foreground'>
              Uploaded {uploadedApk?.originalName ?? ''} · {((uploadedApk?.sizeBytes ?? 0) / 1024 / 1024).toFixed(2)} MB
            </p>
          </Visible>
        </div>
      </Setting>
    </Section>
  )
}
