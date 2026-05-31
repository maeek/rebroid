import { useState, type ChangeEvent } from 'react'
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
  onIconChange: (icon: string | null, isDirty: boolean) => void
}

export const AppManageIconPanel = ({
  appId,
  appName,
  icon,
  initialSettings,
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
