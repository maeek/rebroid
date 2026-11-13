import { Notice } from '@/components/ui/notice'
import { DetailFields, type DetailField } from '@/shared/ui/detail-fields'
import type { DisplayViewerStreamStatus } from '@/features/applications/viewer/display/display-viewer-stream-status'

export type ObservedStreamIssue = {
  surfaceId: string
  status: DisplayViewerStreamStatus
  observedAt: number
}

export const ViewerStreamIssue = ({ issue }: { issue: ObservedStreamIssue }) => {
  const { status, observedAt, surfaceId } = issue
  let transport = 'Unknown'
  if (status.transport === 'webrtc') transport = 'WebRTC'
  if (status.transport === 'websocket') transport = 'WebSocket'
  const fields: DetailField[] = [
    { label: 'Transport', value: transport },
    { label: 'Display', value: surfaceId === 'main' ? 'Main display' : 'Virtual display' },
    { label: 'Observed at', value: new Date(observedAt).toLocaleString() },
    { label: 'Stage', value: (status.failureStage ?? status.code).replaceAll('-', ' ') }
  ]
  if (status.closeCode) fields.push({ label: 'Socket close code', value: status.closeCode })
  if (status.consumerAttemptId) {
    fields.push({
      label: 'Attempt ID',
      value: status.consumerAttemptId,
      copyValue: status.consumerAttemptId,
      code: true
    })
  }
  return (
    <Notice
      title='Last streaming issue'
      tone='warning'
      className='mb-4'
      description={<span className='wrap-anywhere'>{status.message}</span>}
    >
      <DetailFields
        layout='list'
        compact
        fields={fields}
      />
    </Notice>
  )
}
