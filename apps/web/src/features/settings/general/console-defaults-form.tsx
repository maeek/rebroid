'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ConfirmMutationDialog } from '@/components/ui/confirm-mutation-dialog'
import { MutationButton } from '@/components/ui/mutation-button'
import { toast } from '@/hooks/use-toast'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { pickGeneralUiSettings, type GeneralUiSettings } from '@/shared/model/settings/orchestrator-ui-settings'
import { resetGeneralUiSettings, saveGeneralUiSettings } from '@/shared/model/settings/use-orchestrator-ui-settings'
import { ConsoleDefaultsFields } from './general-settings-fields'

export const ConsoleDefaultsForm = ({
  initialSettings,
  loading = false
}: {
  initialSettings: GeneralUiSettings
  loading?: boolean
}) => {
  const [settings, setSettings] = useState(initialSettings)
  const [committed, setCommitted] = useState(initialSettings)
  const [isSaving, setIsSaving] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const resetTrigger = useRef<HTMLButtonElement>(null)
  const dirty = Object.keys(settings).some(
    key => settings[key as keyof GeneralUiSettings] !== committed[key as keyof GeneralUiSettings]
  )

  const saveSettings = async () => {
    setIsSaving(true)
    try {
      const saved = pickGeneralUiSettings(await saveGeneralUiSettings(settings))
      setSettings(saved)
      setCommitted(saved)
      toast({ title: 'Console defaults saved', variant: 'success' })
    } catch (error) {
      toast({
        title: 'Could not save settings',
        description: getDisplayErrorMessage(error),
        variant: 'danger'
      })
    } finally {
      setIsSaving(false)
    }
  }

  const resetSettings = async () => {
    setIsSaving(true)
    try {
      const saved = pickGeneralUiSettings(await resetGeneralUiSettings())
      setSettings(saved)
      setCommitted(saved)
      setResetOpen(false)
      toast({ title: 'Console defaults restored', variant: 'success' })
    } catch (error) {
      toast({
        title: 'Could not reset settings',
        description: getDisplayErrorMessage(error),
        variant: 'danger'
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section
      id='console-defaults'
      className='grid scroll-mt-[calc(var(--console-top-inset)+1rem)] gap-4'
      aria-labelledby='console-defaults-title'
    >
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div>
          <h2
            id='console-defaults-title'
            className='text-lg font-medium'
          >
            Console defaults
          </h2>
          <p className='text-sm text-foreground-muted'>Administrator settings that apply to everyone.</p>
        </div>
        <div className='flex flex-wrap gap-2'>
          <Button
            variant='ghost'
            disabled={loading || isSaving}
            ref={resetTrigger}
            onClick={() => setResetOpen(true)}
          >
            Restore defaults
          </Button>
          <MutationButton
            disabled={loading || !dirty}
            pending={isSaving}
            pendingLabel='Saving…'
            onClick={() => void saveSettings()}
          >
            Save defaults
          </MutationButton>
        </div>
      </div>
      <fieldset
        disabled={isSaving}
        className='grid min-w-0 gap-4'
      >
        <ConsoleDefaultsFields
          settings={settings}
          onSettingsChange={patch => setSettings(current => ({ ...current, ...patch }))}
          loading={loading}
        />
      </fieldset>
      <ConfirmMutationDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        finalFocus={resetTrigger}
        title='Restore console defaults?'
        description='This restores the default app list refresh interval and streaming settings for everyone.'
        confirmLabel='Restore defaults'
        pendingLabel='Restoring…'
        pending={resetOpen && isSaving}
        tone='warning'
        onConfirm={() => void resetSettings()}
      />
    </section>
  )
}
