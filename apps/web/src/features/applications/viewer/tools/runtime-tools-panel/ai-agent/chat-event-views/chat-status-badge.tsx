import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ChatTurnStatus } from '../ai-agent-chat-utils'

const runStatusBadgeVariant = (status: ChatTurnStatus) => {
  if (status === 'failed' || status === 'canceled') return 'destructive'
  if (status === 'success') return 'status'
  return 'secondary'
}

export const ChatStatusBadge = ({ status, children }: { status: ChatTurnStatus; children: string }) => (
  <Badge
    variant={runStatusBadgeVariant(status)}
    className='gap-1.5 border-0 px-2 py-0.5 font-medium capitalize shadow-none'
  >
    <span
      className={cn(
        'size-1.5 rounded-full bg-current opacity-70',
        status === 'running' || status === 'starting' ? 'motion-safe:animate-pulse' : ''
      )}
    />
    {children}
  </Badge>
)
