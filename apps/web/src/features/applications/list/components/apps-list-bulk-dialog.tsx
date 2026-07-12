import { ConfirmMutationDialog } from '@/components/ui/confirm-mutation-dialog'
import { useAppsListContext } from './apps-list-context'
import type { BulkAction, PendingAppAction } from './apps-list-context'

type DialogTone = 'danger' | 'warning'
type RemoveDataKey = 'false' | 'true'

const actionLabels: Record<BulkAction, { singular: string; plural: string }> = {
  stop: { singular: 'Stop app', plural: 'Stop apps' },
  delete: { singular: 'Delete app', plural: 'Delete apps' }
}

const bulkDialogCopy: Record<
  BulkAction,
  {
    verb: string
    description: Record<RemoveDataKey, string>
    details: Record<RemoveDataKey, string[]>
    tone: DialogTone
  }
> = {
  stop: {
    verb: 'Stop',
    description: {
      false: 'The selected apps will stop.',
      true: 'The selected apps will stop.'
    },
    details: {
      false: ['Saved profiles and app records remain available.'],
      true: ['Saved profiles and app records remain available.']
    },
    tone: 'warning'
  },
  delete: {
    verb: 'Delete',
    description: {
      false: 'This removes the selected apps from Rebroid.',
      true: 'This removes the selected apps and their saved data.'
    },
    details: {
      false: ['Saved profile data is preserved when possible.'],
      true: ['Saved profile data is deleted.']
    },
    tone: 'danger'
  }
}

const pluralizeApps = (count: number) => `app${count === 1 ? '' : 's'}`

const removeDataKey = (removeDataOnDelete: boolean): RemoveDataKey => String(removeDataOnDelete) as RemoveDataKey

const pendingDialogCopy: Record<
  BulkAction,
  {
    verb: string
    description: string
    summaryDescription: Record<RemoveDataKey, string>
    tone: DialogTone
  }
> = {
  stop: {
    verb: 'Stop',
    description: 'The current Android runtime will stop.',
    summaryDescription: {
      false: 'Saved profiles remain available for the next start.',
      true: 'Saved profiles remain available for the next start.'
    },
    tone: 'warning'
  },
  delete: {
    verb: 'Delete',
    description: 'This removes the app from Rebroid.',
    summaryDescription: {
      false: 'Saved profile data is preserved when possible.',
      true: 'Saved profile data is deleted with the app.'
    },
    tone: 'danger'
  }
}

const getBulkDialog = (action: BulkAction | null, appNames: string[], removeDataOnDelete: boolean) => {
  const activeAction = action ?? 'delete'
  const copy = bulkDialogCopy[activeAction]
  const count = appNames.length
  const dataKey = removeDataKey(removeDataOnDelete)

  return {
    title: `${copy.verb} ${count} selected ${pluralizeApps(count)}?`,
    description: copy.description[dataKey],
    summaryTitle: `${count} ${pluralizeApps(count)} selected`,
    summaryDescription: appNames.join(', '),
    details: copy.details[dataKey],
    tone: copy.tone,
    buttonLabel: actionLabels[activeAction].plural
  } as const
}

const getPendingDialog = (pendingAction: PendingAppAction | null, removeDataOnDelete: boolean) => {
  const activeAction = pendingAction?.action ?? 'delete'
  const copy = pendingDialogCopy[activeAction]
  const appName = pendingAction?.app.name ?? 'Selected app'
  const dataKey = removeDataKey(removeDataOnDelete)

  return {
    title: `${copy.verb} ${appName}?`,
    description: copy.description,
    summaryTitle: appName,
    summaryDescription: copy.summaryDescription[dataKey],
    tone: copy.tone,
    buttonLabel: actionLabels[activeAction].singular
  } as const
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

  const bulkDialog = getBulkDialog(
    bulkAction,
    activeBulkApps.map(app => app.name),
    removeDataOnDelete
  )
  const pendingDialog = getPendingDialog(pendingAppAction, removeDataOnDelete)

  return (
    <>
      <ConfirmMutationDialog
        open={bulkAction !== null}
        title={bulkDialog.title}
        description={bulkDialog.description}
        summary={`${bulkDialog.summaryTitle}: ${bulkDialog.summaryDescription}`}
        consequence={bulkDialog.details.join(' ')}
        tone={bulkDialog.tone}
        confirmLabel={bulkDialog.buttonLabel}
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
        title={pendingDialog.title}
        description={pendingDialog.description}
        summary={pendingDialog.summaryTitle}
        consequence={pendingDialog.summaryDescription}
        tone={pendingDialog.tone}
        confirmLabel={pendingDialog.buttonLabel}
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
