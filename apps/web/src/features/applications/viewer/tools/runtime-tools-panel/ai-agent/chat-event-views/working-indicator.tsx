import { GradientSparklesIcon } from '@/components/icons/gradient-sparkles-icon'
import type { ChatTurnStatus } from '../ai-agent-chat-utils'

export const WorkingIndicator = ({ status }: { status: ChatTurnStatus }) => (
  <div className='flex items-center gap-2 text-sm text-foreground-muted'>
    <span className='flex items-center gap-1'>
      <GradientSparklesIcon className='size-4' />
    </span>
    <span className='motion-safe:animate-pulse'>{status === 'canceling' ? 'Canceling' : 'Thinking'}</span>
  </div>
)
