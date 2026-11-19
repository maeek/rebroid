import { ConfirmMutationDialog } from '@/components/ui/confirm-mutation-dialog'
import { useAppsListContext } from './apps-list-context'
import type { BulkAction } from './apps-list-context'

type DialogTone = 'danger' | 'warning'

const actionLabels: Record<BulkAction, { singular: string; plural: string }> = {
  stop: { singular: 'Stop app', plural: 'Stop apps' },
  delete: { singular: 'Delete app', plural: 'Delete apps' }
}

const dialogActions: Record<BulkAction, { verb: string; tone: DialogTone }> = {
  stop: {
    verb: 'Stop',
    tone: 'warning'
  },
  delete: {
    verb: 'Delete',
    tone: 'danger'
  }
}

const pluralizeApps = (count: number) => `app${count === 1 ? '' : 's'}`

const getDescription = (action: BulkAction, removeDataOnDelete: boolean, bulk = false) => {
  if (action === 'stop') {
    return bulk ? 'Active viewers of the selected apps disconnect.' : 'Android stops and active viewers disconnect.'
  }

  const target = bulk ? 'the selected apps' : 'the app'
  return removeDataOnDelete
    ? `Permanently delete ${target} and saved profile data.`
    : `Permanently remove ${target} from Rebroid. Saved profile data is kept where possible.`
}

export const AppsListBulkDialog = () => {
  const {
    activeBulkApps,
    bulkAction,
    closeBulkAction,
    closePendingAppAction,
    confirmBulkAction,
    confirmPendingAppAction,
    isBulkWorking,
    pendingAppAction,
    removeDataOnDelete
  } = useAppsListContext()

  const selectedAction = bulkAction ?? 'delete'
  const pendingAction = pendingAppAction?.action ?? 'delete'
  const appCount = activeBulkApps.length

  return (
    <>
      <ConfirmMutationDialog
        open={bulkAction !== null}
        title={`${dialogActions[selectedAction].verb} ${appCount} selected ${pluralizeApps(appCount)}?`}
        description={getDescription(selectedAction, removeDataOnDelete, true)}
        details={
          appCount > 0 ? { label: 'Selected apps', content: activeBulkApps.map(app => app.name).join(', ') } : undefined
        }
        tone={dialogActions[selectedAction].tone}
        confirmLabel={actionLabels[selectedAction].plural}
        pendingLabel={bulkAction === 'stop' ? 'Stopping…' : 'Deleting…'}
        pending={isBulkWorking}
        onOpenChange={open => {
          if (!open) {
            closeBulkAction()
          }
        }}
        onConfirm={() => void confirmBulkAction()}
      />
      <ConfirmMutationDialog
        open={pendingAppAction !== null}
        title={`${dialogActions[pendingAction].verb} ${pendingAppAction?.app.name ?? 'selected app'}?`}
        description={getDescription(pendingAction, removeDataOnDelete)}
        tone={dialogActions[pendingAction].tone}
        confirmLabel={actionLabels[pendingAction].singular}
        pendingLabel={pendingAppAction?.action === 'stop' ? 'Stopping…' : 'Deleting…'}
        pending={isBulkWorking}
        onOpenChange={open => {
          if (!open) {
            closePendingAppAction()
          }
        }}
        onConfirm={() => void confirmPendingAppAction()}
      />
    </>
  )
}
