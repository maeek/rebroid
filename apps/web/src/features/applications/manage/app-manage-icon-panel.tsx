import { useState, type ChangeEvent } from 'react'
import { AppIconField } from '@/features/applications/components/app-icon-field'
import { toast } from '@/hooks/use-toast'
import { getDisplayErrorMessage } from '@/lib/error-utils'
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
  const [pending, setPending] = useState<'upload' | 'remove' | null>(null)
  const [error, setError] = useState<string>()
  const settings = useOrchestratorUiSettings(initialSettings, { refreshOnMount: false })

  const handleIconUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || pending) return

    if (!isFileWithinApkLimit(file, settings.maxApkUploadSizeMb)) {
      setError(`Choose an image under ${apkSizeLabel(settings.maxApkUploadSizeMb)}.`)
      return
    }

    setError(undefined)
    setPending('upload')
    try {
      const optimizedIcon = await optimizeIconFile(file)
      const storedIcon = unwrapActionResult(await setAppIconAction(appId, optimizedIcon))
      notifyRecentAppsUpdated([{ id: appId, name: appName, icon: storedIcon, openedAt: Date.now() }])
      onIconChange(storedIcon, true)
      toast({ title: 'Icon updated', variant: 'success' })
    } catch (cause) {
      setError(getDisplayErrorMessage(cause, 'Could not update the icon.'))
    } finally {
      setPending(null)
    }
  }

  const handleClearIcon = async () => {
    if (pending) return
    setError(undefined)
    setPending('remove')
    try {
      unwrapActionResult(await removeAppIconAction(appId))
      notifyRecentAppsUpdated([{ id: appId, name: appName, icon: null, openedAt: Date.now() }])
      onIconChange(null, true)
      toast({ title: 'Icon removed', variant: 'success' })
    } catch (cause) {
      setError(getDisplayErrorMessage(cause, 'Could not remove the icon.'))
    } finally {
      setPending(null)
    }
  }

  return (
    <AppIconField
      description='Icon changes save immediately.'
      pending={pending === 'upload'}
      pendingLabel='Updating icon…'
      removing={pending === 'remove'}
      error={error}
      appId={appId}
      appName={appName}
      iconPreview={icon}
      onIconChange={event => void handleIconUpload(event)}
      onClearIcon={() => void handleClearIcon()}
    />
  )
}
