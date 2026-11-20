import type { ChangeEvent, ReactNode, Ref } from 'react'
import { IconPackage } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { FileDropZone } from '@/components/ui/file-drop-zone'
import { FileUploadField } from '@/components/ui/file-upload-field'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Section } from '@/components/ui/section'
import { SavedApkPicker } from '../apks/saved-apk-picker'
import { verticalSettingClassName } from './app-form-utils'
import type { UploadedApk } from '@/shared/contracts/application'

type AppIdentitySectionProps = {
  valuesName: string
  onNameChange: (name: string) => void
  uploadedApkLabel?: string | null
  pendingApkName?: string | null
  isUploadingApk: boolean
  apkUploadProgress?: number | null
  onApkSelect: (file: File | null) => void
  onSavedApkSelect?: (apk: UploadedApk) => void | Promise<void>
  onClearApk?: () => void
  uploadDisabled?: boolean
  iconSlot?: React.ReactNode
  nameDescription?: string
  nameRequired?: boolean
  nameLabel?: string
  nameMinLength?: number
  nameModified?: boolean
  nameError?: string
  nameInputRef?: Ref<HTMLInputElement>
  apkError?: string
  apkDescription?: ReactNode
  disabled?: boolean
  surface?: 'plain' | 'band' | 'panel'
}

export const AppIdentitySection = ({
  valuesName,
  onNameChange,
  uploadedApkLabel,
  pendingApkName,
  isUploadingApk,
  apkUploadProgress = null,
  onApkSelect,
  onSavedApkSelect,
  onClearApk,
  uploadDisabled = false,
  iconSlot,
  nameDescription = 'At least 2 characters.',
  nameRequired = true,
  nameLabel = 'Name',
  nameMinLength = 2,
  nameModified,
  nameError,
  nameInputRef,
  apkError,
  apkDescription,
  disabled = false,
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
      contentClassName='gap-4'
    >
      <FormField
        label={nameLabel}
        modified={nameModified}
        description={nameDescription}
        layout='vertical'
        className={verticalSettingClassName}
        required={nameRequired}
        error={nameError}
      >
        <Input
          ref={nameInputRef}
          className='aria-invalid:border-danger'
          value={valuesName}
          required={nameRequired}
          aria-required={nameRequired ? 'true' : 'false'}
          minLength={nameMinLength}
          onChange={handleNameChange}
        />
      </FormField>
      <div className='@container'>
        <div className='grid items-start gap-x-form-column gap-y-4 @min-[50rem]:grid-cols-2'>
          <div className='grid gap-2'>
            <FileDropZone
              disabled={disabled || isUploadingApk || uploadDisabled}
              onFiles={([file]) => onApkSelect(file ?? null)}
            >
              <FormField
                label='APK file'
                error={apkError}
                description={apkDescription ?? 'Optional Android package for this app.'}
                layout='vertical'
                className={verticalSettingClassName}
              >
                <FileUploadField
                  accept='.apk,application/vnd.android.package-archive'
                  disabled={disabled || uploadDisabled}
                  pending={isUploadingApk}
                  pendingLabel={apkUploadProgress === 100 ? 'Processing APK…' : undefined}
                  progress={apkUploadProgress}
                  onChange={handleApkSelect}
                  aria-label='APK file'
                  buttonLabel={uploadedApkLabel ? 'Replace APK' : 'Upload APK'}
                  filenameLabel={isUploadingApk ? (pendingApkName ?? undefined) : (uploadedApkLabel ?? 'No APK')}
                  preview={
                    <div className='grid size-12 place-items-center rounded-control bg-surface-panel text-foreground-muted'>
                      <IconPackage className='size-6' />
                    </div>
                  }
                  previewActions={
                    onSavedApkSelect ? (
                      <SavedApkPicker
                        disabled={disabled || isUploadingApk}
                        onChoose={onSavedApkSelect}
                      />
                    ) : undefined
                  }
                />
              </FormField>
            </FileDropZone>
            {onClearApk ? (
              <Button
                type='button'
                variant='ghost'
                size='sm'
                className='justify-self-start'
                disabled={disabled || isUploadingApk}
                onClick={onClearApk}
              >
                Clear APK
              </Button>
            ) : null}
          </div>
          {iconSlot}
        </div>
      </div>
    </Section>
  )
}
