import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useActivityController } from '../activity-context'
import { formatAction, formatDetails, outcomeTone } from '../activity-format'
import { ActivityResourceTypeBadge } from '../common/activity-resource-type-badge'
import { ActivityDetailField } from './activity-detail-field'
import type { AuditEvent } from '@/server/storage/database'

const ActivityUserAgentField = ({ userAgent }: { userAgent: string | null }) =>
  userAgent ? (
    <ActivityDetailField
      label='User agent'
      value={userAgent}
    />
  ) : null

const ActivityEventDetailContent = ({ event }: { event: AuditEvent }) => (
  <div className='mt-6 grid gap-4'>
    <div className='flex flex-wrap gap-2'>
      <Badge variant={outcomeTone(event.outcome)}>{event.outcome}</Badge>
      <Badge variant='outline'>{event.category}</Badge>
      <ActivityResourceTypeBadge resourceType={event.resourceType} />
    </div>
    <div className='grid gap-3 sm:grid-cols-2'>
      <ActivityDetailField
        label='Actor'
        value={`${event.actorLabel} (${event.actorUserId ?? 'system'})`}
      />
      <ActivityDetailField
        label='Target'
        value={event.resourceLabel ?? event.resourceId ?? event.resourceType}
      />
      <ActivityDetailField
        label='Created'
        value={`${new Date(event.createdAt).toLocaleString()} / ${event.createdAt}`}
      />
      <ActivityDetailField
        label='Source'
        value={event.sourceIp ?? event.userAgent}
      />
    </div>
    <div>
      <Label>Details JSON</Label>
      <pre className='mt-2 max-h-[32rem] overflow-auto rounded-lg border border-border/70 bg-background/60 p-4 font-mono text-xs text-foreground-muted'>
        {formatDetails(event.details)}
      </pre>
    </div>
    <ActivityUserAgentField userAgent={event.userAgent} />
  </div>
)

export const ActivityEventDetailSheet = () => {
  const { selectedEvent, setSelectedEvent } = useActivityController()

  return (
    <Sheet
      open={Boolean(selectedEvent)}
      onOpenChange={open => {
        if (!open) setSelectedEvent(null)
      }}
    >
      <SheetContent className='w-[min(42rem,calc(100vw-2rem))] overflow-y-auto sm:max-w-none'>
        <SheetHeader>
          <SheetTitle>{selectedEvent ? formatAction(selectedEvent.action) : 'Activity details'}</SheetTitle>
          <SheetDescription>Full audit event metadata for review and troubleshooting.</SheetDescription>
        </SheetHeader>
        {selectedEvent && <ActivityEventDetailContent event={selectedEvent} />}
      </SheetContent>
    </Sheet>
  )
}
