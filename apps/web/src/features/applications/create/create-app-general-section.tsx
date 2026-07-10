import type { ReactNode } from 'react'
import { AppIdentitySection } from '@/features/applications/components/app-identity-section'
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

export const AppFormGeneralSection = ({
  values,
  onChange,
  uploadedApk,
  apkLabel,
  isUploadingApk,
  iconSlot,
  onApkSelect
}: AppFormGeneralSectionProps) => {
  const uploadedApkLabel = uploadedApk
    ? `Uploaded ${uploadedApk.originalName} · ${(uploadedApk.sizeBytes / 1024 / 1024).toFixed(2)} MB`
    : apkLabel

  return (
    <AppIdentitySection
      valuesName={values.name}
      onNameChange={value => onChange({ name: value })}
      uploadedApkLabel={uploadedApkLabel}
      isUploadingApk={isUploadingApk}
      onApkSelect={file => onApkSelect(file)}
      iconSlot={iconSlot}
      surface='plain'
    />
  )
}
