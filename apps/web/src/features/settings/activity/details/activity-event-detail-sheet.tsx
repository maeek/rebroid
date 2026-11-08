import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import {
  auditActionLabel,
  auditActorLabel,
  auditValueLabel,
  auditTargetLabel
} from '@/shared/model/audit-event-presentation'
import { DateTimeValue } from '@/shared/ui/date-time-value'
import { DetailFields } from '@/shared/ui/detail-fields'
import { JsonViewer } from '@/shared/ui/json-viewer'
import { useActivityController } from '../activity-context'
import { outcomeTone } from '../activity-format'
import type { AuditEvent } from '@/shared/contracts/audit'

const ActivityEventDetailContent = ({ event }: { event: AuditEvent }) => (
  <div className='mt-6 grid min-w-0 gap-6'>
    <DetailFields
      title='Event'
      fields={[
        {
          label: 'Outcome',
          value: <Badge variant={outcomeTone(event.outcome)}>{auditValueLabel(event.outcome)}</Badge>
        },
        {
          label: 'Time',
          value: (
            <DateTimeValue
              value={event.createdAt}
              showSeconds
            />
          ),
          copyValue: event.createdAt
        },
        { label: 'Action', value: event.action, code: true, copyValue: event.action },
        { label: 'Category', value: auditValueLabel(event.category) },
        { label: 'Event ID', value: String(event.id), copyValue: String(event.id) }
      ]}
    />
    <DetailFields
      title='Actor'
      fields={[
        { label: 'Name', value: auditActorLabel(event) },
        {
          label: 'User ID',
          value: event.actorUserId ?? 'System',
          code: Boolean(event.actorUserId),
          copyValue: event.actorUserId ?? undefined
        }
      ]}
    />
    {event.resourceType || event.resourceId || event.resourceLabel ? (
      <DetailFields
        title='Target'
        fields={[
          { label: 'Name', value: auditTargetLabel(event), fullWidth: true },
          { label: 'Resource type', value: event.resourceType ? auditValueLabel(event.resourceType) : 'Not recorded' },
          {
            label: 'Resource ID',
            value: event.resourceId ?? 'Not recorded',
            code: Boolean(event.resourceId),
            copyValue: event.resourceId ?? undefined
          }
        ]}
      />
    ) : null}
    {event.sourceIp || event.userAgent ? (
      <DetailFields
        title='Request'
        fields={[
          {
            label: 'Source IP',
            value: event.sourceIp ?? 'Not recorded',
            code: true,
            copyValue: event.sourceIp ?? undefined
          },
          { label: 'User agent', value: event.userAgent ?? 'Not recorded', fullWidth: true }
        ]}
      />
    ) : null}
    {Object.keys(event.details).length ? (
      <JsonViewer
        title='Event data'
        value={event.details}
      />
    ) : (
      <p className='text-sm text-foreground-muted'>No additional event data recorded.</p>
    )}
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
      <SheetContent className='w-full overflow-y-auto sm:w-[42rem] sm:max-w-[calc(100vw-2rem)]'>
        <SheetHeader className='pr-6 text-left'>
          <SheetTitle>{selectedEvent ? auditActionLabel(selectedEvent.action) : 'Activity details'}</SheetTitle>
          <SheetDescription>Audit event metadata and recorded request data.</SheetDescription>
        </SheetHeader>
        {selectedEvent && <ActivityEventDetailContent event={selectedEvent} />}
      </SheetContent>
    </Sheet>
  )
}
