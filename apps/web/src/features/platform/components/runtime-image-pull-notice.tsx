import { Notice } from '@/components/ui/notice'
import type { ActionError } from '@/shared/actions/action-result'

const unconfirmedPullMessage = 'Refresh the image list before retrying. The pull may still be running.'

export const unconfirmedImagePull: ActionError = {
  message: unconfirmedPullMessage,
  code: 'upstream_unavailable',
  requestId: ''
}

export const RuntimeImagePullNotice = ({ failure }: { failure: ActionError }) => {
  const unconfirmed = failure.code === 'upstream_unavailable'
  return (
    <Notice
      title={unconfirmed ? 'Image pull could not be confirmed' : 'Could not pull image'}
      tone='danger'
      description={unconfirmed ? unconfirmedPullMessage : failure.message}
    >
      {failure.requestId ? <p>Request ID {failure.requestId}</p> : null}
    </Notice>
  )
}
