'use client'

import { Button } from '@/components/ui/button'
import { DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { MutationButton } from '@/components/ui/mutation-button'
import { Notice } from '@/components/ui/notice'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { renderDeviceError } from '@/shared/contracts/android-rendering-settings'
import type { AndroidRenderingSettings } from '@rebroid/android-application-core/redroid-runtime'

const RenderingFields = ({
  value,
  disabled,
  deviceError,
  onChange
}: {
  value?: AndroidRenderingSettings
  disabled: boolean
  deviceError?: string
  onChange?: (value: AndroidRenderingSettings) => void
}) => (
  <div className='grid gap-4'>
    <FormField
      label='Rendering mode'
      layout='vertical'
    >
      <Select
        value={value?.mode}
        disabled={disabled}
        onValueChange={(mode: AndroidRenderingSettings['mode']) =>
          onChange?.({ mode, renderDevice: value?.renderDevice ?? null })
        }
      >
        <SelectTrigger className='w-full'>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value='software'>Software (default)</SelectItem>
          <SelectItem value='host'>Host GPU</SelectItem>
        </SelectContent>
      </Select>
    </FormField>
    {!value || value.mode === 'host' ? (
      <FormField
        label='GPU render device'
        description='Enter the DRM render node on the Linux host running Docker.'
        error={deviceError}
        layout='vertical'
        required
      >
        <Input
          value={value?.renderDevice ?? ''}
          placeholder='/dev/dri/renderD128'
          autoComplete='off'
          spellCheck={false}
          disabled={disabled}
          onChange={event => onChange?.({ mode: 'host', renderDevice: event.target.value || null })}
        />
      </FormField>
    ) : null}
  </div>
)

export const AndroidRenderingSettingsDialog = ({
  draft,
  pending,
  unavailable,
  valid,
  changed,
  error,
  onChange,
  onSave,
  onCancel
}: {
  draft: AndroidRenderingSettings
  pending: boolean
  unavailable: boolean
  valid: boolean
  changed: boolean
  error?: string
  onChange: (value: AndroidRenderingSettings) => void
  onSave: () => void
  onCancel: () => void
}) => (
  <DialogContent
    data-editor-dialog=''
    className='sm:max-w-lg'
  >
    <DialogHeader>
      <DialogTitle>Edit Android GPU rendering</DialogTitle>
      <DialogDescription>Saved settings apply when managed Redroid applications next start.</DialogDescription>
    </DialogHeader>
    <form
      className='grid gap-6'
      onSubmit={event => {
        event.preventDefault()
        onSave()
      }}
    >
      <RenderingFields
        value={draft}
        disabled={pending || unavailable}
        deviceError={draft.mode === 'host' && !valid ? renderDeviceError : undefined}
        onChange={onChange}
      />
      {error ? (
        <Notice
          tone='danger'
          title='Rendering settings could not be saved'
          description={error}
        />
      ) : null}
      <DialogFooter>
        <Button
          type='button'
          variant='secondary'
          disabled={pending}
          onClick={onCancel}
        >
          Cancel
        </Button>
        <MutationButton
          type='submit'
          pending={pending}
          pendingLabel='Saving…'
          disabled={unavailable || !changed || !valid}
        >
          Save rendering settings
        </MutationButton>
      </DialogFooter>
    </form>
  </DialogContent>
)
