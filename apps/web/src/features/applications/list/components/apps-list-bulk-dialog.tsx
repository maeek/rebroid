import type { ReactNode } from 'react'
import { IconAlertTriangle, IconLoader2, IconPlayerStopFilled, IconTrash } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Visible } from '@/components/ui/visible'
import { AppActionDialogSummary } from '@/features/applications/components/app-action-dialog-summary'
import { useAppsListContext } from './apps-list-context'
import type { BulkAction, PendingAppAction } from './apps-list-context'

type DialogTone = 'danger' | 'warning'
type DialogButtonVariant = 'secondary' | 'danger'
type RemoveDataKey = 'false' | 'true'

const actionLabels: Record<BulkAction, { singular: string; plural: string }> = {
  stop: { singular: 'Stop app', plural: 'Stop apps' },
  delete: { singular: 'Delete app', plural: 'Delete apps' }
}

const actionIcons: Record<BulkAction, ReactNode> = {
  stop: <IconPlayerStopFilled className='size-4' />,
  delete: <IconTrash className='size-4' />
}

const pendingActionIcons: Record<BulkAction, ReactNode> = {
  stop: <IconPlayerStopFilled className='size-4' />,
  delete: <IconAlertTriangle className='size-4' />
}

const bulkDialogCopy: Record<
  BulkAction,
  {
    verb: string
    description: Record<RemoveDataKey, string>
    details: Record<RemoveDataKey, string[]>
    tone: DialogTone
    buttonVariant: DialogButtonVariant
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
    tone: 'warning',
    buttonVariant: 'secondary'
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
    tone: 'danger',
    buttonVariant: 'danger'
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
    buttonVariant: DialogButtonVariant
  }
> = {
  stop: {
    verb: 'Stop',
    description: 'The current Android runtime will stop.',
    summaryDescription: {
      false: 'Saved profiles remain available for the next start.',
      true: 'Saved profiles remain available for the next start.'
    },
    tone: 'warning',
    buttonVariant: 'secondary'
  },
  delete: {
    verb: 'Delete',
    description: 'This removes the app from Rebroid.',
    summaryDescription: {
      false: 'Saved profile data is preserved when possible.',
      true: 'Saved profile data is deleted with the app.'
    },
    tone: 'danger',
    buttonVariant: 'danger'
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
    icon: actionIcons[activeAction],
    tone: copy.tone,
    buttonLabel: actionLabels[activeAction].plural,
    buttonVariant: copy.buttonVariant
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
    icon: pendingActionIcons[activeAction],
    tone: copy.tone,
    buttonLabel: actionLabels[activeAction].singular,
    buttonIcon: actionIcons[activeAction],
    buttonVariant: copy.buttonVariant
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
      <Dialog
        open={bulkAction !== null}
        onOpenChange={open => {
          if (!open) {
            closeBulkAction()
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{bulkDialog.title}</DialogTitle>
            <DialogDescription>{bulkDialog.description}</DialogDescription>
          </DialogHeader>
          <AppActionDialogSummary
            icon={bulkDialog.icon}
            title={bulkDialog.summaryTitle}
            description={bulkDialog.summaryDescription}
            details={bulkDialog.details}
            tone={bulkDialog.tone}
          />
          <DialogFooter>
            <DialogClose asChild>
              <Button
                variant='secondary'
                disabled={isBulkWorking}
              >
                Cancel
              </Button>
            </DialogClose>
            <Button
              variant={bulkDialog.buttonVariant}
              disabled={isBulkWorking || activeBulkApps.length === 0}
              onClick={() => void confirmBulkAction()}
            >
              <Visible when={isBulkWorking}>
                <IconLoader2 className='size-4 animate-spin' />
              </Visible>
              {bulkDialog.buttonLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={pendingAppAction !== null}
        onOpenChange={open => {
          if (!open) {
            closePendingAppAction()
          }
        }}
      >
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>{pendingDialog.title}</DialogTitle>
            <DialogDescription>{pendingDialog.description}</DialogDescription>
          </DialogHeader>
          <AppActionDialogSummary
            icon={pendingDialog.icon}
            title={pendingDialog.summaryTitle}
            description={pendingDialog.summaryDescription}
            tone={pendingDialog.tone}
          />
          <DialogFooter>
            <DialogClose asChild>
              <Button variant='secondary'>Cancel</Button>
            </DialogClose>
            <Button
              variant={pendingDialog.buttonVariant}
              onClick={() => void confirmPendingAppAction()}
            >
              {pendingDialog.buttonIcon}
              {pendingDialog.buttonLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
