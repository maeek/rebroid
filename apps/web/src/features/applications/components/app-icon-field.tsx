import { type ChangeEvent } from 'react'
import { IconApps } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { EditorFormContext } from '@/components/ui/editor-form-context'
import { FileUploadField } from '@/components/ui/file-upload-field'
import { FormField } from '@/components/ui/form-field'
import { Switch } from '@/components/ui/switch'
import { AppIcon } from '@/shared/ui/app-icon/app-icon'

type AppIconFieldProps = {
  appId?: string
  appName: string
  iconPreview: string | null
  autoExtractIcon?: boolean
  onAutoExtractIconChange?: (checked: boolean) => void
  disabled?: boolean
  pending?: boolean
  description?: string
  modified?: boolean
  statusLabel?: string
  onResetIcon?: () => void
  error?: string
  onIconChange: (event: ChangeEvent<HTMLInputElement>) => void
  onClearIcon?: () => void
}

export const AppIconField = ({
  appId = 'new',
  appName,
  iconPreview,
  autoExtractIcon,
  onAutoExtractIconChange,
  disabled = false,
  pending = false,
  description = 'Optional launcher artwork for this app.',
  modified,
  statusLabel,
  onResetIcon,
  error,
  onIconChange,
  onClearIcon
}: AppIconFieldProps) => {
  let status = 'Default icon'
  if (iconPreview && autoExtractIcon === undefined) status = 'Current icon'
  if (iconPreview && autoExtractIcon !== undefined) status = autoExtractIcon ? 'Icon from APK' : 'Custom icon'

  return (
    <div className='grid min-w-0 gap-2'>
      <FormField
        label='Icon'
        description={description}
        modified={modified}
        resetAction={onResetIcon ? { label: 'Undo icon change', onReset: onResetIcon } : undefined}
        error={error}
        layout='vertical'
      >
        <FileUploadField
          aria-label='App icon'
          accept='image/*'
          pending={pending}
          pendingLabel='Preparing icon…'
          disabled={disabled}
          onChange={onIconChange}
          buttonLabel={iconPreview ? 'Replace icon' : 'Upload icon'}
          filenameLabel={pending ? '' : (statusLabel ?? status)}
          preview={
            appName || iconPreview ? (
              <AppIcon
                appId={appId}
                appName={appName || 'App'}
                icon={iconPreview}
                className='size-12 text-base'
              />
            ) : (
              <div className='grid size-12 place-items-center rounded-control bg-surface-panel text-foreground-muted'>
                <IconApps className='size-6' />
              </div>
            )
          }
        />
      </FormField>
      {onAutoExtractIconChange ? (
        <EditorFormContext.Provider value={false}>
          <FormField
            label='Use icon from APK'
            layout='horizontal'
            className='relative min-h-11 px-2'
          >
            <Switch
              checked={autoExtractIcon}
              disabled={disabled || pending}
              onCheckedChange={onAutoExtractIconChange}
              className='after:absolute after:inset-0'
            />
          </FormField>
        </EditorFormContext.Provider>
      ) : null}
      {onClearIcon && iconPreview ? (
        <Button
          type='button'
          variant='ghost'
          size='sm'
          className='justify-self-start'
          disabled={disabled || pending}
          onClick={onClearIcon}
        >
          Remove icon
        </Button>
      ) : null}
    </div>
  )
}
