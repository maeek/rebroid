import type { ChatTurnStatus } from '../ai-agent-chat-utils'

export const WorkingIndicator = ({ status }: { status: ChatTurnStatus }) => (
  <div
    role='status'
    className='flex items-center gap-2 py-1 text-xs text-foreground-muted'
  >
    <span className='flex items-center gap-1'>
      {[0, 1, 2].map(index => (
        <span
          key={index}
          className='size-1.5 rounded-full bg-primary motion-safe:animate-pulse'
          style={{ animationDelay: `${index * 160}ms` }}
        />
      ))}
    </span>
    <span>{status === 'canceling' ? 'Stopping safely…' : 'Working on the next step…'}</span>
  </div>
)
