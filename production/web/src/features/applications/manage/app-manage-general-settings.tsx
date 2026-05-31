import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTopLoader } from 'nextjs-toploader'
import { Badge } from '@/components/ui/badge'
import { Section } from '@/components/ui/section'
import { Visible } from '@/components/ui/visible'
import { uploadApkWithProgress } from '@/features/applications/apks/upload'
import { AppFormGeneralSection } from '@/features/applications/create/create-app-general-section'
import { Setting } from '@/features/settings/components/setting'
import {
  apkSizeLabel,
  isFileWithinApkLimit,
  useOrchestratorUiSettings
} from '@/features/settings/hooks/use-orchestrator-ui-settings'
import { toast } from '@/hooks/use-toast'
import { updateApkAction } from '@/server/orchestrator/applications/mutation-actions'
import type { AppFormValues } from '@/features/applications/create/create-app-form.types'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { OrchestratorUiSettings } from '@/features/settings/hooks/use-orchestrator-ui-settings'
import type { AndroidApplicationStatusDetail } from '@/server/orchestrator/applications/types'

type AppManageGeneralSettingsProps = {
  app?: AppDefinition
  appId: string
  values: AppFormValues
  initialSettings: OrchestratorUiSettings
  onAppNameChange: (value: string) => void
}

const verticalSettingClassName = 'flex-col items-start w-full'
const formatStatusLabel = (value?: string | null) => (value ? value.replaceAll('_', ' ') : 'unknown')

export const AppManageGeneralSettings = ({
  app,
  appId,
  values,
  initialSettings,
  onAppNameChange
}: AppManageGeneralSettingsProps) => {
  const [isUploadingApk, setIsUploadingApk] = useState(false)
  const settings = useOrchestratorUiSettings(initialSettings, { refreshOnMount: false })
  const router = useRouter()
  const topLoader = useTopLoader()
  const lifecycleLabel = formatStatusLabel(app?.lifecycleStage)
  const statusLabel = app?.status ?? 'unknown'
  const statusDetail = app
    ? (app as AppDefinition & { statusDetail: AndroidApplicationStatusDetail | null }).statusDetail
    : null
  const statusDescription = statusDetail?.description ?? app?.statusMessage
  const shouldShowLifecycleBadge = lifecycleLabel.toLowerCase() !== statusLabel.toLowerCase()

  const handleApkUpload = async (file: File | null) => {
    if (!file) return

    if (!isFileWithinApkLimit(file, settings.maxApkUploadSizeMb)) {
      toast({
        title: 'APK is too large',
        description: `The configured upload limit is ${apkSizeLabel(settings.maxApkUploadSizeMb)}.`,
        variant: 'destructive'
      })
      return
    }

    setIsUploadingApk(true)
    topLoader.start()
    topLoader.setProgress(0.08)

    try {
      const uploaded = await uploadApkWithProgress({
        file,
        onProgress: progress => {
          topLoader.setProgress(Math.min(Math.max(progress / 100, 0.08), 0.95))
        }
      })
      topLoader.setProgress(1)
      await updateApkAction(appId, uploaded.id)
      toast({ title: 'APK uploaded' })
      router.refresh()
    } catch (error) {
      toast({
        title: 'Could not upload APK',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
    } finally {
      topLoader.done(true)
      setIsUploadingApk(false)
    }
  }

  return (
    <>
      <AppFormGeneralSection
        values={values}
        apkLabel={app?.apkOriginalName ? `Current APK: ${app.apkOriginalName}` : 'No APK uploaded'}
        isUploadingApk={isUploadingApk}
        onChange={patch => {
          if (patch.name !== undefined) {
            onAppNameChange(patch.name)
          }
        }}
        onApkSelect={file => void handleApkUpload(file)}
      />
      <Section
        title='Current state'
        boxed
        titleClassName='pb-4'
        contentClassName='gap-5'
      >
        <Setting
          label='State'
          className={verticalSettingClassName}
          variant='vertical'
        >
          <div className='flex flex-wrap gap-2'>
            <Badge
              variant={app?.status === 'error' ? 'destructive' : 'status'}
              className='capitalize'
            >
              {statusLabel}
            </Badge>
            <Visible when={shouldShowLifecycleBadge}>
              <Badge
                className='capitalize'
                variant='secondary'
              >
                {lifecycleLabel}
              </Badge>
            </Visible>
          </div>
          <Visible when={statusDescription}>
            <p className='mt-2 text-sm text-secondary-foreground'>{statusDescription}</p>
          </Visible>
        </Setting>
      </Section>
    </>
  )
}
