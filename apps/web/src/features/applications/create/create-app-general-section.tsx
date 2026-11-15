import type { ReactNode, Ref } from 'react'
import { AppIdentitySection } from '@/features/applications/components/app-identity-section'
import type { AppFormValues } from './create-app-form.types'
import type { UploadedApk } from '@/shared/contracts/application'

type AppFormGeneralSectionProps = {
  values: AppFormValues
  onChange: (patch: Partial<AppFormValues>) => void
  uploadedApk?: UploadedApk | null
  apkLabel?: string | null
  pendingApkName?: string | null
  isUploadingApk: boolean
  disabled?: boolean
  iconSlot?: ReactNode
  nameError?: string
  nameInputRef?: Ref<HTMLInputElement>
  apkError?: string
  onApkSelect: (file: File | null) => void
}

export const AppFormGeneralSection = ({
  values,
  onChange,
  uploadedApk,
  apkLabel,
  pendingApkName,
  isUploadingApk,
  disabled,
  iconSlot,
  nameError,
  nameInputRef,
  apkError,
  onApkSelect
}: AppFormGeneralSectionProps) => {
  const uploadedApkLabel = uploadedApk ? uploadedApk.originalName : apkLabel

  return (
    <AppIdentitySection
      valuesName={values.name}
      onNameChange={value => onChange({ name: value })}
      uploadedApkLabel={uploadedApkLabel}
      pendingApkName={pendingApkName}
      isUploadingApk={isUploadingApk}
      disabled={disabled}
      onApkSelect={file => onApkSelect(file)}
      iconSlot={iconSlot}
      nameError={nameError}
      nameInputRef={nameInputRef}
      apkError={apkError}
      surface='plain'
    />
  )
}
