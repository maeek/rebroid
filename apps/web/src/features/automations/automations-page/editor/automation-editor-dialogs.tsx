import { IconAlertTriangle, IconTrash } from '@tabler/icons-react'
import { GradientSparklesIcon } from '@/components/icons/gradient-sparkles-icon'
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
import { selectCatalogModel } from '@/shared/automation/automation-ai-catalog'
import { AiModelPicker } from '@/shared/ui/ai/ai-model-picker'
import { AiPromptComposer } from '@/shared/ui/ai/ai-prompt-composer'
import type { AutomationAiModelCatalogProvider } from '@/server/orchestrator/settings/types'

export const AiDraftDialog = ({
  open,
  busy,
  catalog,
  providerId,
  modelId,
  prompt,
  onDraft,
  onModelChange,
  onOpenChange,
  onProviderChange,
  onPromptChange
}: {
  open: boolean
  busy: boolean
  catalog: AutomationAiModelCatalogProvider[]
  providerId: string
  modelId: string
  prompt: string
  onDraft: () => void
  onModelChange: (modelId: string) => void
  onOpenChange: (open: boolean) => void
  onProviderChange: (providerId: string) => void
  onPromptChange: (prompt: string) => void
}) => {
  const selectedProvider = catalog.find(provider => provider.id === providerId) ?? catalog[0]
  const selectedModel = selectCatalogModel(selectedProvider, modelId)

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <GradientSparklesIcon className='size-5' />
            Draft automation
          </DialogTitle>
          <DialogDescription>Generate a runnable AI automation draft into the YAML editor.</DialogDescription>
        </DialogHeader>
        <AiPromptComposer
          value={prompt}
          rows={6}
          variant='plain'
          placeholder='Describe the workflow this automation should perform.'
          textareaClassName='min-h-32'
          onChange={onPromptChange}
          onSubmit={() => {
            if (busy || !prompt.trim() || !selectedProvider || !selectedModel) return
            onDraft()
          }}
          modelControl={
            <AiModelPicker
              catalog={catalog}
              selectedProvider={selectedProvider}
              selectedModel={selectedModel}
              onProviderChange={onProviderChange}
              onModelChange={onModelChange}
            />
          }
          actions={
            <>
              <DialogClose asChild>
                <Button variant='secondary'>Cancel</Button>
              </DialogClose>
              <Button
                disabled={busy || !prompt.trim() || !selectedProvider || !selectedModel}
                onClick={onDraft}
              >
                <GradientSparklesIcon className='size-4' />
                Draft
              </Button>
            </>
          }
        />
      </DialogContent>
    </Dialog>
  )
}

export const AutomationDeleteConfirmDialog = ({
  open,
  busy,
  automationName,
  onConfirm,
  onOpenChange
}: {
  open: boolean
  busy: boolean
  automationName: string
  onConfirm: () => void
  onOpenChange: (open: boolean) => void
}) => (
  <Dialog
    open={open}
    onOpenChange={onOpenChange}
  >
    <DialogContent className='sm:max-w-md'>
      <DialogHeader>
        <DialogTitle>Delete {automationName}?</DialogTitle>
        <DialogDescription>This removes the workflow and its triggers.</DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <DialogClose asChild>
          <Button
            variant='secondary'
            disabled={busy}
          >
            Cancel
          </Button>
        </DialogClose>
        <Button
          variant='destructive'
          disabled={busy}
          onClick={onConfirm}
        >
          <IconTrash className='size-4' />
          Delete
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
)

export const UnsavedAutomationChangesDialog = ({
  open,
  onConfirm,
  onOpenChange
}: {
  open: boolean
  onConfirm: () => void
  onOpenChange: (open: boolean) => void
}) => (
  <Dialog
    open={open}
    onOpenChange={onOpenChange}
  >
    <DialogContent className='sm:max-w-md'>
      <DialogHeader>
        <DialogTitle>Leave without saving?</DialogTitle>
        <DialogDescription>This workflow has unsaved changes. Leaving now will discard them.</DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant='secondary'>Stay</Button>
        </DialogClose>
        <Button onClick={onConfirm}>
          <IconAlertTriangle className='size-4' />
          Leave
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
)
