import { useState, type Ref } from 'react'
import { useRouter } from 'next/navigation'
import { uploadApkWithFeedback } from '@/features/applications/apks/upload-apk-with-feedback'
import { AppIdentitySection } from '@/features/applications/components/app-identity-section'
import { toast } from '@/hooks/use-toast'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { updateApkAction } from '@/server/orchestrator/applications/actions/configuration/create-update-actions'
import { unwrapActionResult } from '@/shared/actions/action-result'
import { useOrchestratorUiSettings } from '@/shared/model/settings/use-orchestrator-ui-settings'
import { AppManageIconPanel, type AppManageIconPanelProps } from './app-manage-icon-panel'
import type { AppFormValues } from '@/features/applications/create/create-app-form.types'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { UploadedApk } from '@/shared/contracts/application'
import type { OrchestratorUiSettings } from '@/shared/model/settings/use-orchestrator-ui-settings'

type AppManageGeneralSettingsProps = {
  app?: AppDefinition
  appId: string
  canReplaceApk?: boolean
  canUploadApk?: boolean
  values: AppFormValues
  initialSettings: OrchestratorUiSettings
  iconEditor: Omit<AppManageIconPanelProps, 'appId' | 'appName' | 'maxUploadSizeMb'>
  nameError?: string
  nameInputRef?: Ref<HTMLInputElement>
  onAppNameChange: (value: string) => void
}

export const AppManageGeneralSettings = ({
  app,
  appId,
  canReplaceApk = false,
  canUploadApk = false,
  values,
  initialSettings,
  iconEditor,
  nameError,
  nameInputRef,
  onAppNameChange
}: AppManageGeneralSettingsProps) => {
  const [pendingApkName, setPendingApkName] = useState<string | null>(null)
  const [apkUploadProgress, setApkUploadProgress] = useState<number | null>(null)
  const [apkError, setApkError] = useState<string>()
  const settings = useOrchestratorUiSettings(initialSettings, { refreshOnMount: false })
  const router = useRouter()
  const replaceApk = async (apk: UploadedApk) => {
    setApkError(undefined)
    unwrapActionResult(await updateApkAction(appId, apk.id))
    toast({ title: 'APK update accepted', variant: 'success' })
    router.refresh()
  }

  const handleApkUpload = async (file: File | null) => {
    if (!file || pendingApkName !== null || !canReplaceApk || !canUploadApk) return

    setPendingApkName(file.name)
    setApkError(undefined)

    try {
      const uploaded = await uploadApkWithFeedback({
        errorTitle: 'Could not upload APK',
        file,
        maxApkUploadSizeMb: settings.maxApkUploadSizeMb,
        onProgress: setApkUploadProgress,
        onError: setApkError
      })
      if (!uploaded) return

      await replaceApk(uploaded)
    } catch (cause) {
      setApkError(getDisplayErrorMessage(cause, 'Could not replace the APK.'))
    } finally {
      setPendingApkName(null)
      setApkUploadProgress(null)
    }
  }

  return (
    <AppIdentitySection
      valuesName={values.name}
      nameLabel='Name'
      nameModified={Boolean(app && values.name !== app.name)}
      nameError={nameError}
      nameInputRef={nameInputRef}
      apkDescription='APK changes save immediately.'
      apkError={apkError}
      onNameChange={onAppNameChange}
      uploadedApkLabel={app?.apkOriginalName}
      isUploadingApk={pendingApkName !== null}
      pendingApkName={pendingApkName}
      apkUploadProgress={apkUploadProgress}
      onSavedApkSelect={canReplaceApk ? replaceApk : undefined}
      uploadDisabled={!canReplaceApk || !canUploadApk}
      onApkSelect={file => {
        void handleApkUpload(file)
      }}
      iconSlot={
        <AppManageIconPanel
          {...iconEditor}
          appId={appId}
          appName={values.name}
          maxUploadSizeMb={settings.maxApkUploadSizeMb}
        />
      }
    />
  )
}
