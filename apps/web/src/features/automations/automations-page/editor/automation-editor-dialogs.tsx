import { IconAlertTriangle, IconCircleCheck, IconLoader2, IconSparkles, IconTrash } from '@tabler/icons-react'
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
import { Textarea } from '@/components/ui/textarea'
import { selectCatalogModel } from '@/shared/automation/automation-ai-catalog'
import { AiModelPicker } from '@/shared/ui/ai/ai-model-picker'
import { AiPromptComposer } from '@/shared/ui/ai/ai-prompt-composer'
import type { AiDraftLogItem, AiDraftStatus } from './use-automation-ai-draft'
import type { AutomationAiModelCatalogProvider } from '@/server/orchestrator/settings/types'

export const AiDraftDialog = ({
  open,
  busy,
  catalog,
  clarificationAnswer,
  clarificationQuestion,
  draftLog,
  draftStatus,
  hasDraftResult,
  providerId,
  modelId,
  prompt,
  onApplyDraft,
  onCancelDraft,
  onDraft,
  onClarificationAnswerChange,
  onModelChange,
  onOpenChange,
  onProviderChange,
  onPromptChange,
  onSubmitClarification
}: {
  open: boolean
  busy: boolean
  catalog: AutomationAiModelCatalogProvider[]
  clarificationAnswer: string
  clarificationQuestion: string | null
  draftLog: AiDraftLogItem[]
  draftStatus: AiDraftStatus
  hasDraftResult: boolean
  providerId: string
  modelId: string
  prompt: string
  onApplyDraft: () => void
  onCancelDraft: () => void
  onDraft: () => void
  onClarificationAnswerChange: (answer: string) => void
  onModelChange: (modelId: string) => void
  onOpenChange: (open: boolean) => void
  onProviderChange: (providerId: string) => void
  onPromptChange: (prompt: string) => void
  onSubmitClarification: () => void
}) => {
  const selectedProvider = catalog.find(provider => provider.id === providerId) ?? catalog[0]
  const selectedModel = selectCatalogModel(selectedProvider, modelId)
  const running = draftStatus === 'running'
  const needsInput = draftStatus === 'needs-input'
  const completed = draftStatus === 'completed' && hasDraftResult

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
          disabled={running}
          placeholder='Describe the workflow this automation should perform.'
          textareaClassName='min-h-32'
          onChange={onPromptChange}
          onSubmit={() => {
            if (busy || running || !prompt.trim() || !selectedProvider || !selectedModel) return
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
              {running ? (
                <Button
                  variant='secondary'
                  onClick={onCancelDraft}
                >
                  Cancel
                </Button>
              ) : (
                <Button
                  variant='secondary'
                  onClick={() => onOpenChange(false)}
                >
                  Close
                </Button>
              )}
              {completed ? (
                <Button onClick={onApplyDraft}>
                  <IconCircleCheck className='size-4' />
                  Apply draft
                </Button>
              ) : needsInput ? (
                <Button
                  disabled={!clarificationAnswer.trim()}
                  onClick={onSubmitClarification}
                >
                  Continue
                </Button>
              ) : (
                <Button
                  disabled={busy || running || !prompt.trim() || !selectedProvider || !selectedModel}
                  onClick={onDraft}
                >
                  {running ? <IconLoader2 className='size-4 animate-spin' /> : <IconSparkles className='size-4' />}
                  Draft
                </Button>
              )}
            </>
          }
        />
        {draftLog.length > 0 ? (
          <div className='grid gap-2 rounded-md border border-border/70 bg-surface-panel/40 p-3'>
            <div className='flex items-center gap-2 text-sm font-medium'>
              {running ? <IconLoader2 className='size-4 animate-spin' /> : <IconSparkles className='size-4' />}
              {completed ? 'Draft ready' : needsInput ? 'More detail needed' : 'Draft progress'}
            </div>
            <div className='max-h-44 overflow-y-auto pr-1 text-xs text-foreground-muted'>
              {draftLog.map(item => (
                <div
                  key={item.id}
                  className='py-1'
                >
                  {item.message}
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {needsInput && clarificationQuestion ? (
          <div className='grid gap-2'>
            <div className='text-sm font-medium'>{clarificationQuestion}</div>
            <Textarea
              value={clarificationAnswer}
              rows={3}
              className='resize-none'
              placeholder='Answer so the draft can continue.'
              onChange={event => onClarificationAnswerChange(event.target.value)}
            />
          </div>
        ) : null}
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
