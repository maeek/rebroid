'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ConfirmMutationDialog } from '@/components/ui/confirm-mutation-dialog'
import { MutationButton } from '@/components/ui/mutation-button'
import { useSaveFeedback } from '@/hooks/use-save-feedback'
import { toast } from '@/hooks/use-toast'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { pickGeneralUiSettings, type GeneralUiSettings } from '@/shared/model/settings/orchestrator-ui-settings'
import { resetGeneralUiSettings, saveGeneralUiSettings } from '@/shared/model/settings/use-orchestrator-ui-settings'
import { EditorPage } from '@/shared/ui/page/editor-page'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent } from '@/shared/ui/page/page-layout'
import { ConsoleDefaultsFields } from './ui/console-defaults-fields'

export const ConsoleDefaultsPageClient = ({
  initialSettings,
  loading = false
}: {
  initialSettings: GeneralUiSettings
  loading?: boolean
}) => {
  const [settings, setSettings] = useState(initialSettings)
  const [committed, setCommitted] = useState(initialSettings)
  const [isSaving, setIsSaving] = useState(false)
  const saveFeedback = useSaveFeedback(JSON.stringify(settings))
  const [resetOpen, setResetOpen] = useState(false)
  const resetTrigger = useRef<HTMLButtonElement>(null)
  const dirty = Object.keys(settings).some(
    key => settings[key as keyof GeneralUiSettings] !== committed[key as keyof GeneralUiSettings]
  )

  const saveSettings = async () => {
    saveFeedback.resetSaveFeedback()
    setIsSaving(true)
    try {
      const saved = pickGeneralUiSettings(await saveGeneralUiSettings(settings))
      setSettings(saved)
      setCommitted(saved)
      saveFeedback.confirmSaved(JSON.stringify(saved))
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
    <EditorPage className='gap-2'>
      <PageHeader
        section={{ label: 'Administration' }}
        trail={[{ label: 'General', href: '/platform/runtime' }]}
        title='Console defaults'
        description='Default list refresh and streaming settings for all users.'
        actions={
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
              success={saveFeedback.saved}
              onClick={() => void saveSettings()}
            >
              Save defaults
            </MutationButton>
          </div>
        }
      />
      <PageContent>
        <fieldset
          disabled={loading || isSaving}
          className='grid min-w-0 gap-4'
        >
          <ConsoleDefaultsFields
            settings={settings}
            onSettingsChange={patch => setSettings(current => ({ ...current, ...patch }))}
            loading={loading}
          />
        </fieldset>
      </PageContent>
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
    </EditorPage>
  )
}
