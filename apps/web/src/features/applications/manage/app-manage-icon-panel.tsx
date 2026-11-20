import { useState, type ChangeEvent } from 'react'
import { AppIconField } from '@/features/applications/components/app-icon-field'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { optimizeIconFile } from '@/shared/model/media/icon-metadata'
import { apkSizeLabel, isFileWithinApkLimit } from '@/shared/model/settings/use-orchestrator-ui-settings'

export type AppManageIconPanelProps = {
  appId: string
  appName: string
  icon: string | null
  maxUploadSizeMb: number
  modified?: boolean
  disabled?: boolean
  pending?: boolean
  saveError?: string
  onIconChange: (icon: string | null) => void
  onPreparingChange?: (pending: boolean) => void
  onResetIcon?: () => void
}

export const AppManageIconPanel = ({
  appId,
  appName,
  icon,
  maxUploadSizeMb,
  modified,
  disabled,
  pending,
  saveError,
  onIconChange,
  onPreparingChange,
  onResetIcon
}: AppManageIconPanelProps) => {
  const [error, setError] = useState<string>()

  const handleIconUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || disabled || pending) return

    if (!isFileWithinApkLimit(file, maxUploadSizeMb)) {
      setError(`Choose an image under ${apkSizeLabel(maxUploadSizeMb)}.`)
      return
    }

    setError(undefined)
    onPreparingChange?.(true)
    try {
      onIconChange(await optimizeIconFile(file))
    } catch (cause) {
      setError(getDisplayErrorMessage(cause, 'Could not prepare the icon.'))
    } finally {
      onPreparingChange?.(false)
    }
  }

  const statusLabel = icon ? 'New icon' : 'Removal pending'

  return (
    <AppIconField
      description='Click Save to apply icon changes.'
      modified={modified}
      statusLabel={modified ? statusLabel : undefined}
      disabled={disabled}
      pending={pending}
      error={error ?? saveError}
      appId={appId}
      appName={appName}
      iconPreview={icon}
      onIconChange={event => void handleIconUpload(event)}
      onClearIcon={() => {
        setError(undefined)
        onIconChange(null)
      }}
      onResetIcon={
        modified && !disabled && !pending && onResetIcon
          ? () => {
              setError(undefined)
              onResetIcon()
            }
          : undefined
      }
    />
  )
}
