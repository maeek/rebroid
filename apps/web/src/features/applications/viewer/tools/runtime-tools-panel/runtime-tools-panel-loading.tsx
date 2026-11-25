import { Skeleton } from '@/components/ui/skeleton'
import { AiPromptComposer } from '@/shared/ui/ai/ai-prompt-composer'
import { AiAgentConversationLayout, AiAgentConversationToolbar } from './ai-agent/ai-agent-conversation-layout'
import { AiAgentTranscriptLayout, AiAgentTranscriptSkeleton } from './ai-agent/ai-agent-transcript-layout'
import { DownloadsToolsLoading } from './files/downloads-tools-loading'
import { RuntimeToolPanelLayout } from './runtime-tool-panel-layout'
import { AppWorkflowsLoading } from './workflows/app-workflows-loading'
import type { RuntimeToolId } from './runtime-tool-definitions'

const noop = () => undefined

export const RuntimeToolLoadingContent = ({ toolId }: { toolId: RuntimeToolId }) => {
  if (toolId === 'files') return <DownloadsToolsLoading />
  if (toolId === 'workflows') return <AppWorkflowsLoading />

  return (
    <AiAgentConversationLayout
      toolbar={<AiAgentConversationToolbar loading />}
      transcript={
        <AiAgentTranscriptLayout>
          <AiAgentTranscriptSkeleton />
        </AiAgentTranscriptLayout>
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
            actions={<Skeleton className='touch-control size-9 rounded-full' />}
          />
        </div>
      }
    />
  )
}

export const RuntimeToolsPanelLoading = ({ toolId }: { toolId: RuntimeToolId }) => (
  <RuntimeToolPanelLayout toolId={toolId}>
    <RuntimeToolLoadingContent toolId={toolId} />
  </RuntimeToolPanelLayout>
)
