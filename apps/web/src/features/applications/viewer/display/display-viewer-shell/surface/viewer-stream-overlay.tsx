import { StateView, type StateViewAction } from '@/shared/ui/state-view'
import type { ViewerStreamStatus } from '@rebroid/android-application-core/viewer-stream'

export const ViewerStreamOverlay = ({
  status,
  retryError,
  retryAction
}: {
  status?: ViewerStreamStatus
  retryError?: string | null
  retryAction: StateViewAction
}) => {
  if (!status?.blocking) return null

  return (
    <div className='absolute inset-0 overflow-auto transform-gpu bg-background'>
      {status.code === 'reconnecting' ? (
        <StateView
          className='py-4'
          kind='loading'
          scope='immersive'
          headingLevel={2}
          title='Reconnecting…'
          description='The live display will resume when the connection returns.'
        />
      ) : (
        <StateView
          className='py-4'
          kind='error'
          scope='immersive'
          headingLevel={2}
          title='Live display paused'
          description='The connection to the app screen was interrupted.'
          detail={retryError ?? undefined}
          actions={[retryAction]}
        />
      )}
    </div>
  )
}
