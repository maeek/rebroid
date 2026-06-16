import { Badge } from '@/components/ui/badge'
import type { ChatTurnStatus } from '../ai-agent-chat-utils'

const runStatusBadgeVariant = (status: ChatTurnStatus) =>
  status === 'failed' || status === 'canceled' ? 'destructive' : 'secondary'

export const ChatStatusBadge = ({ status, children }: { status: ChatTurnStatus; children: string }) => (
  <Badge
    variant={runStatusBadgeVariant(status)}
    className='capitalize'
  >
    {children}
  </Badge>
)
