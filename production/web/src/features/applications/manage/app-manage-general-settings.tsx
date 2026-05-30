import { useRef, useState, type ChangeEvent } from 'react'
import { IconUpload } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { useTopLoader } from 'nextjs-toploader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Section } from '@/components/ui/section'
import { Visible } from '@/components/ui/visible'
import { uploadApkWithProgress } from '@/features/applications/apks/upload'
import { Setting } from '@/features/settings/components/setting'
import {
  apkSizeLabel,
  isFileWithinApkLimit,
  useOrchestratorUiSettings
} from '@/features/settings/hooks/use-orchestrator-ui-settings'
import { toast } from '@/hooks/use-toast'
import { updateApkAction } from '@/server/orchestrator/applications/mutation-actions'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { OrchestratorUiSettings } from '@/features/settings/hooks/use-orchestrator-ui-settings'
import type { AndroidApplicationStatusDetail } from '@/server/orchestrator/applications/types'

type AppManageGeneralSettingsProps = {
  app?: AppDefinition
  appId: string
  appName: string
  initialSettings: OrchestratorUiSettings
  onAppNameChange: (value: string) => void
}

const verticalSettingClassName = 'flex-col items-start w-full'
const formatStatusLabel = (value?: string | null) => (value ? value.replaceAll('_', ' ') : 'unknown')

export const AppManageGeneralSettings = ({
  app,
  appId,
  appName,
  initialSettings,
  onAppNameChange
}: AppManageGeneralSettingsProps) => {
  const [isUploadingApk, setIsUploadingApk] = useState(false)
  const apkInputRef = useRef<HTMLInputElement>(null)
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

  const handleApkUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!isFileWithinApkLimit(file, settings.maxApkUploadSizeMb)) {
      toast({
        title: 'APK is too large',
        description: `The configured upload limit is ${apkSizeLabel(settings.maxApkUploadSizeMb)}.`,
        variant: 'destructive'
      })
      event.target.value = ''
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
      event.target.value = ''
    }
  }

  return (
    <Section
      title='General'
      boxed
      titleClassName='pb-4'
      contentClassName='gap-5'
    >
      <Setting
        label='Name'
        className={verticalSettingClassName}
        variant='vertical'
        required
      >
        <Input
          value={appName}
          required
          aria-required='true'
          minLength={2}
          onChange={event => onAppNameChange(event.target.value)}
        />
      </Setting>
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
      <Setting
        label='APK'
        className={verticalSettingClassName}
        variant='vertical'
      >
        <div className='flex w-full flex-col gap-3'>
          <p className='text-secondary-foreground'>{app?.apkOriginalName || 'No APK uploaded'}</p>
          <input
            ref={apkInputRef}
            type='file'
            accept='.apk,application/vnd.android.package-archive'
            className='hidden'
            onChange={event => void handleApkUpload(event)}
          />
          <Button
            type='button'
            disabled={isUploadingApk}
            onClick={() => apkInputRef.current?.click()}
          >
            <IconUpload className='size-4' />
            Upload APK
          </Button>
        </div>
      </Setting>
    </Section>
  )
}
