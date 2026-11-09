import { ConfirmMutationDialog } from '@/components/ui/confirm-mutation-dialog'
import { useActivityController } from '../activity-context'

export const ActivityPurgeDialog = () => {
  const controller = useActivityController()
  return (
    <ConfirmMutationDialog
      open={controller.purgeOpen}
      onOpenChange={controller.setPurgeOpen}
      title='Purge all activity logs?'
      description='Permanently delete every existing audit event. This includes events outside the current filters.'
      consequence='This cannot be undone. A new purge event will be recorded after deletion.'
      confirmationText='PURGE'
      confirmLabel='Purge all logs'
      pendingLabel='Purging…'
      pending={controller.isPurging}
      onConfirm={() => void controller.purgeAll()}
    />
  )
}
