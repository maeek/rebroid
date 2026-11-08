import { useState, type ChangeEvent } from 'react'
import { AppFormIconSection } from '@/features/applications/create/create-app-icon-section'
import { toast } from '@/hooks/use-toast'
import { removeAppIconAction } from '@/server/app-icons/actions/remove-app-icon-action'
import { setAppIconAction } from '@/server/app-icons/actions/set-app-icon-action'
import { unwrapActionResult } from '@/shared/actions/action-result'
import { optimizeIconFile } from '@/shared/model/media/icon-metadata'
import { notifyRecentAppsUpdated } from '@/shared/model/recent-apps/recent-apps'
import {
  apkSizeLabel,
  isFileWithinApkLimit,
  useOrchestratorUiSettings
} from '@/shared/model/settings/use-orchestrator-ui-settings'
import type { OrchestratorUiSettings } from '@/shared/model/settings/use-orchestrator-ui-settings'

type AppManageIconPanelProps = {
  id?: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean
  appId: string
  appName: string
  icon: string | null
  initialSettings: OrchestratorUiSettings
  compact?: boolean
  onIconChange: (icon: string | null, isDirty: boolean) => void
}

export const AppManageIconPanel = ({
  id,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
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
        variant: 'danger'
      })
      event.target.value = ''
      return
    }

    setIsUploadingIcon(true)
    try {
      const optimizedIcon = await optimizeIconFile(file)
      const storedIcon = unwrapActionResult(await setAppIconAction(appId, optimizedIcon))
      notifyRecentAppsUpdated([{ id: appId, name: appName, icon: storedIcon, openedAt: Date.now() }])
      onIconChange(storedIcon, true)
      toast({ title: 'Icon updated', variant: 'success' })
    } catch (error) {
      toast({
        title: 'Could not update icon',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'danger'
      })
    } finally {
      setIsUploadingIcon(false)
      event.target.value = ''
    }
  }

  const handleClearIcon = async () => {
    setIsUploadingIcon(true)
    try {
      unwrapActionResult(await removeAppIconAction(appId))
      notifyRecentAppsUpdated([{ id: appId, name: appName, icon: null, openedAt: Date.now() }])
      onIconChange(null, true)
      toast({ title: 'Icon cleared', variant: 'success' })
    } catch (error) {
      toast({
        title: 'Could not clear icon',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'danger'
      })
    } finally {
      setIsUploadingIcon(false)
    }
  }

  return (
    <AppFormIconSection
      id={id}
      aria-describedby={ariaDescribedBy}
      aria-invalid={ariaInvalid}
      showDescription={!compact}
      pending={isUploadingIcon}
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
