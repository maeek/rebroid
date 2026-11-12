import { IconCircleCheck, IconSparkles } from '@tabler/icons-react'
import Link from 'next/link'
import { GradientSparklesIcon } from '@/components/icons/gradient-sparkles-icon'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { FormField } from '@/components/ui/form-field'
import { MutationButton } from '@/components/ui/mutation-button'
import { Notice } from '@/components/ui/notice'
import { Section } from '@/components/ui/section'
import { Textarea } from '@/components/ui/textarea'
import { selectCatalogModel } from '@/shared/model/ai-model-catalog'
import { AiModelPicker } from '@/shared/ui/ai/ai-model-picker'
import { AiPromptComposer } from '@/shared/ui/ai/ai-prompt-composer'
import type { AiDraftLogItem, AiDraftStatus } from './use-automation-ai-draft'
import type { AutomationAiModelCatalogProvider } from '@/shared/contracts/ai-provider'

export const AiDraftDialog = ({
  open,
  busy,
  catalog,
  catalogStatus,
  canManageAi,
  draftError,
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
  catalogStatus: 'loading' | 'ready' | 'error'
  canManageAi: boolean
  draftError: string | null
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
  const selectedModel = selectCatalogModel(selectedProvider, modelId, 'planner')
  const running = draftStatus === 'running'
  const needsInput = draftStatus === 'needs-input'
  const completed = draftStatus === 'completed' && hasDraftResult

  const hasModel = Boolean(selectedProvider && selectedModel)
  const canGenerate = hasModel && !busy && !running && Boolean(prompt.trim())
  const latestPhase = draftLog.findLast(item => item.type === 'draft.phase')

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent className='max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <GradientSparklesIcon className='size-5' />
            Draft workflow with AI
          </DialogTitle>
          <DialogDescription>
            Describe the steps you want. Review the generated workflow before saving it.
          </DialogDescription>
        </DialogHeader>
        {!hasModel ? (
          <Notice
            loading={catalogStatus === 'loading'}
            tone={catalogStatus === 'error' ? 'danger' : 'info'}
            title={catalogStatus === 'error' ? 'Could not load planning models' : 'Add a planning model'}
            description={
              catalogStatus === 'error'
                ? 'Reload the workflow editor and try again.'
                : 'Enable a model with the Planning purpose in Platform → AI.'
            }
            actions={
              canManageAi && catalogStatus === 'ready' ? (
                <Button
                  variant='secondary'
                  size='sm'
                  asChild
                >
                  <Link href='/platform/ai'>Open AI settings</Link>
                </Button>
              ) : null
            }
          />
        ) : (
          <>
            <AiPromptComposer
              value={prompt}
              ariaLabel='Describe your workflow'
              rows={4}
              variant='plain'
              disabled={running}
              placeholder='For example, open the app and wait for the home screen…'
              onChange={onPromptChange}
              onSubmit={() => {
                if (canGenerate && !needsInput && !completed) onDraft()
              }}
              modelControl={
                <fieldset
                  disabled={running}
                  inert={running || undefined}
                  className='min-w-0'
                >
                  <AiModelPicker
                    catalog={catalog}
                    selectedProvider={selectedProvider}
                    selectedModel={selectedModel}
                    onProviderChange={onProviderChange}
                    onModelChange={onModelChange}
                  />
                </fieldset>
              }
            />
            {running ? (
              <p
                role='status'
                className='text-sm text-foreground-muted'
              >
                {latestPhase?.message ?? 'Preparing your draft…'}
              </p>
            ) : null}
            {completed ? (
              <Notice
                tone='success'
                title='Draft ready'
                description='Apply it to review and edit the generated steps.'
              />
            ) : null}
            {draftError ? (
              <Notice
                tone='danger'
                title='Could not generate draft'
                description={draftError}
              />
            ) : null}
            {needsInput && clarificationQuestion ? (
              <FormField
                controlId='workflow-draft-answer'
                label={clarificationQuestion}
                layout='vertical'
              >
                <Textarea
                  value={clarificationAnswer}
                  rows={2}
                  className='resize-none'
                  onChange={event => onClarificationAnswerChange(event.target.value)}
                />
              </FormField>
            ) : null}
            {draftLog.length > 0 ? (
              <Section
                surface='plain'
                title='Generation details'
                headingSpacing='compact'
                collapsible
              >
                <div className='grid max-h-32 gap-1 overflow-y-auto break-words text-xs text-foreground-muted'>
                  {draftLog.map(item => (
                    <div key={item.id}>{item.message}</div>
                  ))}
                </div>
              </Section>
            ) : null}
          </>
        )}
        <DialogFooter>
          <Button
            variant='secondary'
            onClick={running ? onCancelDraft : () => onOpenChange(false)}
          >
            {running ? 'Cancel generation' : 'Close'}
          </Button>
          {hasModel && completed ? (
            <Button onClick={onApplyDraft}>
              <IconCircleCheck
                aria-hidden='true'
                className='size-4'
              />{' '}
              Apply draft
            </Button>
          ) : null}
          {hasModel && needsInput ? (
            <Button
              disabled={!clarificationAnswer.trim() || busy}
              onClick={onSubmitClarification}
            >
              Continue
            </Button>
          ) : null}
          {hasModel && !completed && !needsInput ? (
            <MutationButton
              pending={running}
              pendingLabel='Generating…'
              disabled={!canGenerate}
              onClick={onDraft}
            >
              <IconSparkles
                aria-hidden='true'
                className='size-4'
              />
              {draftError ? 'Try again' : 'Generate draft'}
            </MutationButton>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
