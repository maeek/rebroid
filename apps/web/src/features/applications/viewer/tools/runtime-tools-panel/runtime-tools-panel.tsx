'use client'

import { useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Notice } from '@/components/ui/notice'
import { Skeleton } from '@/components/ui/skeleton'
import { appResourceHref } from '@/features/applications/detail/app-resource-links'
import { useApplicationViewerApp } from '@/features/applications/detail/application-viewer-context'
import { cn } from '@/lib/utils'
import { AiPromptComposer } from '@/shared/ui/ai/ai-prompt-composer'
import { AiAgentConversationLayout, AiAgentConversationToolbar } from './ai-agent/ai-agent-conversation-layout'
import { AiAgentTranscript } from './ai-agent/ai-agent-transcript'
import { RuntimeToolContent } from './runtime-tool-content'
import { runtimeInlineSectionClassName } from './runtime-tool-definitions'
import { getRuntimeTools, runtimeToolPanelClassName, type RuntimeToolId } from './runtime-tool-definitions'
import { ToolSection } from './tool-section'
import type { AutomationRun } from '@/shared/contracts/automation'

export const RuntimeToolsPanel = ({ toolId }: { toolId: RuntimeToolId }) => {
  const router = useRouter()
  const { app, initialSettings, permissions } = useApplicationViewerApp()
  const [latestAutomationRun, setLatestAutomationRun] = useState<AutomationRun | null>(null)
  const available = getRuntimeTools({ permissions }).some(tool => tool.id === toolId)
  if (!available)
    return (
      <Notice
        title='Tool unavailable'
        description='You do not have permission to use this tool.'
      />
    )

  return (
    <RuntimeToolPanelLayout toolId={toolId}>
      {toolId ? (
        <RuntimeToolContent
          app={app}
          initialAiContextualSuggestionsEnabled={initialSettings.aiContextualSuggestionsEnabled}
          latestAutomationRun={latestAutomationRun}
          onOpenWorkflowDraft={() => router.push('/automations/create')}
          onRunStarted={setLatestAutomationRun}
          onToolSelected={next => {
            if (next !== toolId) router.push(appResourceHref(app.id, next))
          }}
          permissions={permissions}
          toolId={toolId}
        />
      ) : null}
    </RuntimeToolPanelLayout>
  )
}

export const RuntimeToolPanelLayout = ({ toolId, children }: { toolId: RuntimeToolId; children: ReactNode }) => (
  <div className='flex min-h-0 w-full flex-1 flex-col'>
    <div className='flex min-h-0 flex-1 flex-col overflow-hidden'>
      <div
        id={toolId ? `runtime-tool-panel-${toolId}` : undefined}
        aria-label={toolId}
        className={cn('min-h-0', toolId !== 'ai-agent' && 'py-4', runtimeToolPanelClassName(toolId))}
      >
        {children}
      </div>
    </div>
  </div>
)

const noop = () => undefined

export const RuntimeToolsPanelLoading = ({ toolId }: { toolId: RuntimeToolId }) => {
  const transcriptRef = useRef<HTMLDivElement>(null)
  let content: ReactNode = <Skeleton className='min-h-64 w-full' />
  if (toolId === 'ai-agent')
    content = (
      <AiAgentConversationLayout
        toolbar={<AiAgentConversationToolbar loading />}
        transcript={
          <AiAgentTranscript
            canSaveWorkflow={false}
            draftingRunId={null}
            isLoadingHistory
            onApproveEscalation={noop}
            onSaveWorkflow={noop}
            onTranscriptScroll={noop}
            transcriptRef={transcriptRef}
            turns={[]}
          />
        }
        composer={
          <div inert>
            <AiPromptComposer
              value=''
              placeholder=''
              rows={2}
              ariaLabel='Message the device agent'
              disabled
              onChange={noop}
              leadingControl={<Skeleton className='size-8 rounded-full' />}
              modelControl={<Skeleton className='h-8 w-32' />}
              actions={<Skeleton className='size-9 rounded-full' />}
            />
          </div>
        }
      />
    )
  if (toolId === 'clipboard')
    content = (
      <ToolSection
        title='Clipboard'
        hideHeader
        className={runtimeInlineSectionClassName}
        actions={
          <Button
            size='sm'
            variant='ghost'
            disabled
          >
            Read from device
          </Button>
        }
      >
        <Skeleton className='h-24 w-full' />
      </ToolSection>
    )
  if (toolId === 'workflows')
    content = (
      <section className='grid min-h-0 gap-4'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <div>
            <h3 className='text-sm font-medium'>Workflow activity</h3>
            <p className='mt-0.5 text-xs text-foreground-muted'>Run workflows and inspect their live execution.</p>
          </div>
          <Button disabled>Run workflow</Button>
        </div>
        {content}
      </section>
    )
  return <RuntimeToolPanelLayout toolId={toolId}>{content}</RuntimeToolPanelLayout>
}
