import { ConfirmMutationDialog } from '@/components/ui/confirm-mutation-dialog'
import { useActivityController } from '../activity-context'

export const ActivityPurgeDialog = () => {
  const controller = useActivityController()
  return (
    <ConfirmMutationDialog
      open={controller.purgeOpen}
      onOpenChange={controller.setPurgeOpen}
      title='Purge all activity logs?'
      description='Permanently delete all audit events, including those outside the current filters. Rebroid records a new event for the purge.'
      confirmationText='PURGE'
      confirmLabel='Purge all logs'
      pendingLabel='Purging…'
      pending={controller.isPurging}
      onConfirm={() => void controller.purgeAll()}
    />
  )
}
