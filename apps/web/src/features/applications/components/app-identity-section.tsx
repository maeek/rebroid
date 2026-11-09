import type { ChangeEvent } from 'react'
import { FileUploadField } from '@/components/ui/file-upload-field'
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
  nameError?: string
  apkError?: string
  surface?: 'plain' | 'band' | 'panel'
}

export const AppIdentitySection = ({
  valuesName,
  onNameChange,
  uploadedApkLabel,
  isUploadingApk,
  onApkSelect,
  iconSlot,
  nameDescription = 'At least 2 characters.',
  apkDescription = 'Optional. Upload an APK to extract its app details and icon.',
  nameRequired = true,
  nameLabel = 'Name',
  nameMinLength = 2,
  nameError,
  apkError,
  surface = 'plain'
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
      <div className='grid'>
        <div className='flex flex-col gap-5'>
          <FormField
            label={nameLabel}
            description={nameDescription}
            layout='vertical'
            className={verticalSettingClassName}
            required={nameRequired}
            error={nameError}
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
            error={apkError}
            description={apkDescription}
            layout='vertical'
            className={verticalSettingClassName}
          >
            <FileUploadField
              accept='.apk,application/vnd.android.package-archive'
              pending={isUploadingApk}
              onChange={handleApkSelect}
              aria-label='APK file'
              buttonLabel='Upload APK'
              filenameLabel={uploadedApkLabel}
            />
          </FormField>
          <Visible when={iconSlot}>
            <FormField
              label='Icon'
              description='Optional launcher artwork for this app.'
              layout='vertical'
            >
              {iconSlot}
            </FormField>
          </Visible>
        </div>
      </div>
    </Section>
  )
}
