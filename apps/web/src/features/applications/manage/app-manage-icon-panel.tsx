import { useState, type ChangeEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Visible } from '@/components/ui/visible'
import { AppIcon } from '@/features/applications/components/app-icon'
import { AppFormIconSection } from '@/features/applications/create/create-app-icon-section'
import { optimizeIconFile } from '@/features/applications/icons/icon-metadata'
import { notifyRecentAppsUpdated } from '@/features/applications/recent/recent-apps'
import {
  apkSizeLabel,
  isFileWithinApkLimit,
  useOrchestratorUiSettings
} from '@/features/settings/hooks/use-orchestrator-ui-settings'
import { toast } from '@/hooks/use-toast'
import { removeAppIconAction } from '@/server/app-icons/actions/remove-app-icon-action'
import { setAppIconAction } from '@/server/app-icons/actions/set-app-icon-action'
import type { OrchestratorUiSettings } from '@/features/settings/hooks/use-orchestrator-ui-settings'

type AppManageIconPanelProps = {
  appId: string
  appName: string
  icon: string | null
  initialSettings: OrchestratorUiSettings
  compact?: boolean
  onIconChange: (icon: string | null, isDirty: boolean) => void
}

export const AppManageIconPanel = ({
  appId,
  appName,
  icon,
  initialSettings,
  compact = false,
  onIconChange
}: AppManageIconPanelProps) => {
  const [isUploadingIcon, setIsUploadingIcon] = useState(false)
  const settings = useOrchestratorUiSettings(initialSettings, { refreshOnMount: false })

  const handleIconUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!isFileWithinApkLimit(file, settings.maxApkUploadSizeMb)) {
      toast({
        title: 'File is too large',
        description: `The configured upload limit is ${apkSizeLabel(settings.maxApkUploadSizeMb)}.`,
        variant: 'destructive'
      })
      event.target.value = ''
      return
    }

    setIsUploadingIcon(true)
    try {
      const optimizedIcon = await optimizeIconFile(file)
      const storedIcon = await setAppIconAction(appId, optimizedIcon)
      notifyRecentAppsUpdated([{ id: appId, name: appName, icon: storedIcon, openedAt: Date.now() }])
      onIconChange(storedIcon, true)
      toast({ title: 'Icon updated' })
    } catch (error) {
      toast({
        title: 'Could not update icon',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
    } finally {
      setIsUploadingIcon(false)
      event.target.value = ''
    }
  }

  const handleClearIcon = async () => {
    setIsUploadingIcon(true)
    try {
      await removeAppIconAction(appId)
      notifyRecentAppsUpdated([{ id: appId, name: appName, icon: null, openedAt: Date.now() }])
      onIconChange(null, true)
      toast({ title: 'Icon cleared' })
    } catch (error) {
      toast({
        title: 'Could not clear icon',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
    } finally {
      setIsUploadingIcon(false)
    }
  }

  if (compact) {
    return (
      <div className='flex w-full flex-col items-center gap-5'>
        <AppIcon
          appId={appId}
          appName={appName || 'App'}
          icon={icon}
          className='size-44 text-4xl shadow-[0_18px_60px_rgba(0,0,0,0.24)] max-sm:size-36'
        />
        <div className='flex w-full gap-2 max-sm:flex-col'>
          <Input
            type='file'
            accept='image/*'
            disabled={isUploadingIcon}
            onChange={event => void handleIconUpload(event)}
          />
          <Visible when={icon}>
            <Button
              type='button'
              variant='secondary'
              className='shrink-0'
              disabled={isUploadingIcon}
              onClick={() => void handleClearIcon()}
            >
              Clear
            </Button>
          </Visible>
        </div>
      </div>
    )
  }

  return (
    <AppFormIconSection
      appId={appId}
      appName={appName}
      iconPreview={icon}
      autoExtractIcon={false}
      hasExtractedIcon={false}
      disabled={isUploadingIcon}
      showAutoExtract={false}
      onIconChange={event => void handleIconUpload(event)}
      onClearIcon={() => void handleClearIcon()}
      onAutoExtractIconChange={() => undefined}
    />
  )
}
