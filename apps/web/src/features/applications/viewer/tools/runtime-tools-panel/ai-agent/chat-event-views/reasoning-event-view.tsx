import { IconBrain } from '@tabler/icons-react'
import { generationSummary } from '../ai-agent-chat-presentation'
import type { AutomationRunEvent } from '@/server/orchestrator/automations/types'

export const ReasoningEventView = ({ event }: { event: AutomationRunEvent }) => {
  const summary = generationSummary(event)
  if (!summary) return null
  return (
    <div className='flex flex-wrap items-center gap-x-2 gap-y-1 py-0.5 text-[11px] text-foreground-muted'>
      <span className='flex size-5 items-center justify-center rounded-md bg-foreground/5 text-foreground-muted'>
        <IconBrain className='size-3.5' />
      </span>
      <span>{summary.label}</span>
      {summary.details.length > 0 ? (
        <span className='text-foreground-muted/70'>· {summary.details.join(' · ')}</span>
      ) : null}
    </div>
  )
}
