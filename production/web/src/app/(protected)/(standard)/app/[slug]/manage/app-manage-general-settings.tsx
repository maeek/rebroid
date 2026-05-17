import { useRef, useState, type ChangeEvent } from 'react'
import { IconUpload } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { useTopLoader } from 'nextjs-toploader'
import { Setting } from '@/app/(protected)/_components/settings/setting'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Section } from '@/components/ui/section'
import { toast } from '@/hooks/use-toast'
import { uploadApkWithProgress } from '@/lib/apks/upload'
import { updateApkAction } from '@/lib/orchestrator/actions'
import { apkSizeLabel, isFileWithinApkLimit, useOrchestratorUiSettings } from '@/lib/orchestrator/settings'
import type { AppDefinition } from '@/app/(protected)/(standard)/constants'
import type { AndroidApplicationStatusDetail } from '@/lib/orchestrator/types'

type AppManageGeneralSettingsProps = {
  app?: AppDefinition
  appId: string
  appName: string
  onAppNameChange: (value: string) => void
}

const verticalSettingClassName = 'flex-col items-start w-full'
const formatStatusLabel = (value?: string | null) => (value ? value.replaceAll('_', ' ') : 'unknown')

export const AppManageGeneralSettings = ({ app, appId, appName, onAppNameChange }: AppManageGeneralSettingsProps) => {
  const [isUploadingApk, setIsUploadingApk] = useState(false)
  const apkInputRef = useRef<HTMLInputElement>(null)
  const settings = useOrchestratorUiSettings()
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
      >
        <Input
          value={appName}
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
          {shouldShowLifecycleBadge && (
            <Badge
              className='capitalize'
              variant='secondary'
            >
              {lifecycleLabel}
            </Badge>
          )}
        </div>
        {statusDescription && <p className='mt-2 text-sm text-secondary-foreground'>{statusDescription}</p>}
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
