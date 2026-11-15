'use client'

import { useRef, useState } from 'react'
import { IconArrowUp, IconPlayerStopFilled } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { MutationSwitch } from '@/components/ui/mutation-switch'
import { Section } from '@/components/ui/section'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useImmediateSave } from '@/hooks/use-immediate-save'
import { toast } from '@/hooks/use-toast'
import { AiComposerAction } from '@/shared/ui/ai/ai-composer-action'
import { AiPromptComposer } from '@/shared/ui/ai/ai-prompt-composer'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'

export const ImmediateFeedbackPreview = () => {
  const [enabled, setEnabled] = useState(false)
  const feedback = useImmediateSave()
  const completion = useRef<ReturnType<typeof Promise.withResolvers<void>> | null>(null)
  const [prompt, setPrompt] = useState('Open settings')
  const [status, setStatus] = useState('')
  const [running, setRunning] = useState(false)
  const [canceling, setCanceling] = useState(false)
  const [error, setError] = useState('')
  const textarea = useRef<HTMLTextAreaElement>(null)
  const submit = () => {
    if (!prompt.trim()) return
    setPrompt('')
    setStatus(running ? 'Queued for your next run' : 'Message sent')
    setRunning(true)
    textarea.current?.focus({ preventScroll: true })
  }
  return (
    <TooltipProvider>
      <StandardPage>
        <PageHeader title='Immediate feedback' />
        <PageContent>
          <Section
            title='Immediate save'
            surface='panel'
            contentClassName='gap-4'
          >
            <MutationSwitch
              aria-label='Enable task'
              checked={enabled}
              pending={feedback.pendingId !== null}
              success={feedback.savedId === 'task'}
              onCheckedChange={next => {
                completion.current = Promise.withResolvers<void>()
                const request = completion.current.promise
                void feedback
                  .save('task', async () => {
                    await request
                    setEnabled(next)
                  })
                  .catch(() => {
                    toast({ title: 'Could not save task', variant: 'danger' })
                  })
              }}
            />
            <div className='flex flex-wrap gap-2'>
              <Button onClick={() => completion.current?.resolve()}>Confirm save</Button>
              <Button onClick={() => completion.current?.reject(new Error('Offline'))}>Fail save</Button>
            </div>
          </Section>
          <Section
            title='Device agent'
            surface='panel'
            contentClassName='gap-4'
          >
            <AiPromptComposer
              value={prompt}
              placeholder='Ask the agent…'
              rows={2}
              textareaRef={textarea}
              status={status}
              errors={[error]}
              onChange={setPrompt}
              onSubmit={prompt.trim() ? submit : undefined}
              submitOnEnter={!running}
              modelControl={<span className='text-xs text-foreground-muted'>Local model</span>}
              actions={
                <AiComposerAction
                  label={canceling ? 'Canceling' : running ? 'Stop' : 'Send message'}
                  disabled={!running && !prompt.trim()}
                  pending={canceling}
                  onClick={running ? () => setCanceling(true) : submit}
                >
                  {running ? <IconPlayerStopFilled aria-hidden /> : <IconArrowUp aria-hidden />}
                </AiComposerAction>
              }
            />
            <div className='flex flex-wrap gap-2'>
              <Button onClick={() => setStatus('Device stopped. Start this app to send a new message.')}>
                Show status
              </Button>
              <Button onClick={() => setError('Could not start the agent. Your prompt has been kept; try again.')}>
                Show error
              </Button>
              <Button onClick={() => toast({ title: 'Settings saved', variant: 'success', timeout: 0 })}>
                Show toast
              </Button>
            </div>
          </Section>
        </PageContent>
      </StandardPage>
    </TooltipProvider>
  )
}
