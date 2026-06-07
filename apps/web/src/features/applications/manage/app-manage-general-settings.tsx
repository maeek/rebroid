import { useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useTopLoader } from 'nextjs-toploader'
import { uploadApkWithFeedback } from '@/features/applications/apks/upload-apk-with-feedback'
import { AppIdentitySection } from '@/features/applications/components/app-identity-section'
import { useOrchestratorUiSettings } from '@/features/settings/hooks/use-orchestrator-ui-settings'
import { toast } from '@/hooks/use-toast'
import { updateApkAction } from '@/server/orchestrator/applications/actions/configuration/create-update-actions'
import type { AppFormValues } from '@/features/applications/create/create-app-form.types'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { OrchestratorUiSettings } from '@/features/settings/hooks/use-orchestrator-ui-settings'

type AppManageGeneralSettingsProps = {
  app?: AppDefinition
  appId: string
  values: AppFormValues
  initialSettings: OrchestratorUiSettings
  iconSlot?: ReactNode
  onAppNameChange: (value: string) => void
}

export const AppManageGeneralSettings = ({
  app,
  appId,
  values,
  initialSettings,
  iconSlot,
  onAppNameChange
}: AppManageGeneralSettingsProps) => {
  const [isUploadingApk, setIsUploadingApk] = useState(false)
  const settings = useOrchestratorUiSettings(initialSettings, { refreshOnMount: false })
  const router = useRouter()
  const topLoader = useTopLoader()

  const handleApkUpload = async (file: File | null) => {
    if (!file) return

    setIsUploadingApk(true)

    try {
      const uploaded = await uploadApkWithFeedback({
        errorTitle: 'Could not upload APK',
        file,
        maxApkUploadSizeMb: settings.maxApkUploadSizeMb,
        topLoader
      })
      if (!uploaded) return

      await updateApkAction(appId, uploaded.id)
      toast({ title: 'APK uploaded' })
      router.refresh()
    } finally {
      setIsUploadingApk(false)
    }
  }

  return (
    <AppIdentitySection
      valuesName={values.name}
      nameLabel='Name'
      nameDescription='Display name shown in the UI for this app. Minimum 2 characters.'
      onNameChange={onAppNameChange}
      uploadedApkLabel={app?.apkOriginalName ? `Current APK: ${app.apkOriginalName}` : 'No APK uploaded'}
      isUploadingApk={isUploadingApk}
      onApkSelect={file => {
        void handleApkUpload(file)
      }}
      iconSlot={iconSlot}
    />
  )
}
