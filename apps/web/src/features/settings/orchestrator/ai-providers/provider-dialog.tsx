import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { FormField } from '@/components/ui/form-field'
import { MutationButton } from '@/components/ui/mutation-button'
import { Notice } from '@/components/ui/notice'
import { Switch } from '@/components/ui/switch'
import { useDialogPayload } from '@/hooks/use-dialog-payload'
import { ProviderConnectionFields } from './provider-connection-fields'
import { createProviderDraft, openAiStarterModel, type ProviderFormState } from './provider-form-model'

export const ProviderDialog = ({
  provider: currentProvider,
  existingIds = [],
  error,
  isSaving,
  onChange,
  onClose,
  onSave
}: {
  provider: ProviderFormState | null
  existingIds?: readonly string[]
  error?: string | null
  isSaving: boolean
  onChange: (provider: ProviderFormState | null) => void
  onClose: () => void
  onSave: () => void
}) => {
  const { payload: provider, onOpenChangeComplete } = useDialogPayload(currentProvider)
  const openAi = provider?.kind === 'openai'

  return (
    <Dialog
      open={Boolean(currentProvider)}
      onOpenChangeComplete={onOpenChangeComplete}
      onOpenChange={open => {
        if (!open && !isSaving) onClose()
      }}
    >
      <DialogContent
        data-editor-dialog=''
        className='max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg'
      >
        <DialogHeader>
          <DialogTitle>Add AI provider</DialogTitle>
          <DialogDescription>Connect a provider to draft workflows and use AI in automations.</DialogDescription>
        </DialogHeader>
        <form
          className='grid min-w-0 gap-5'
          onSubmit={event => {
            event.preventDefault()
            if (!isSaving) onSave()
          }}
        >
          {provider ? (
            <fieldset
              disabled={isSaving}
              className='grid min-w-0 gap-5'
            >
              <ProviderConnectionFields
                provider={provider}
                mode='create'
                onChange={patch => onChange({ ...provider, ...patch })}
                onKindChange={kind => onChange(createProviderDraft(kind, existingIds))}
              />
              {openAi ? (
                <FormField
                  controlId='provider-create-starter-model'
                  label='Add GPT-5.6 Luna'
                  description='Use Luna for workflow drafts. Turn this off to choose a different model after connecting.'
                  layout='horizontal'
                >
                  <Switch
                    checked={provider.models.length > 0}
                    onCheckedChange={checked => onChange({ ...provider, models: checked ? [openAiStarterModel] : [] })}
                  />
                </FormField>
              ) : (
                <p className='text-sm text-foreground-muted'>Choose a model after connecting to your server.</p>
              )}
            </fieldset>
          ) : null}
          {error ? (
            <Notice
              tone='danger'
              title='Could not connect provider'
              description={error}
            />
          ) : null}
          <DialogFooter>
            <DialogClose asChild>
              <Button
                type='button'
                variant='secondary'
                disabled={isSaving}
              >
                Cancel
              </Button>
            </DialogClose>
            <MutationButton
              type='submit'
              pending={isSaving}
              pendingLabel='Connecting…'
              disabled={!provider?.id.trim() || !provider.baseUrl.trim() || (openAi && !provider.apiKey?.trim())}
            >
              {openAi ? 'Connect OpenAI' : 'Connect provider'}
            </MutationButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
