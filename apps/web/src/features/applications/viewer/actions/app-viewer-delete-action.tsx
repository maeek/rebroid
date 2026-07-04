'use client'

import { useState } from 'react'
import { IconLoader2, IconTrash, IconX } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { AppActionDialogSummary } from '@/features/applications/components/app-action-dialog-summary'
import { toast } from '@/hooks/use-toast'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { removeAppIconAction } from '@/server/app-icons/actions/remove-app-icon-action'
import { deleteApplicationAction } from '@/server/orchestrator/applications/actions/lifecycle/lifecycle-actions'
import { forgetRecentAppAction } from '@/server/recent-apps/actions'
import { unwrapActionResult } from '@/shared/actions/action-result'
import { notifyRecentAppsUpdated } from '@/shared/model/recent-apps/recent-apps'
import { useOrchestratorUiSettings } from '@/shared/model/settings/use-orchestrator-ui-settings'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { OrchestratorUiSettings } from '@/shared/model/settings/use-orchestrator-ui-settings'

export const AppViewerDeleteAction = ({
  app,
  initialSettings
}: {
  app?: AppDefinition
  initialSettings: OrchestratorUiSettings
}) => {
  const [open, setOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const router = useRouter()
  const settings = useOrchestratorUiSettings(initialSettings, { refreshOnMount: false })
  const isProvisioning = app?.status === 'provisioning'

  const handleDelete = async () => {
    if (!app) {
      return
    }

    setIsDeleting(true)
    try {
      await deleteApplicationAction(app.id, settings.removeDataOnDelete)
      unwrapActionResult(await removeAppIconAction(app.id))
      await forgetRecentAppAction(app.id).then(notifyRecentAppsUpdated)
      setOpen(false)
      router.push('/apps')
    } catch (error) {
      toast({
        title: isProvisioning ? 'Could not kill app provisioning' : 'Could not delete app',
        description: getDisplayErrorMessage(error),
        variant: 'destructive'
      })
      setIsDeleting(false)
    }
  }

  return (
    <Dialog
      modal
      open={open}
      onOpenChange={nextOpen => {
        if (!isDeleting) {
          setOpen(nextOpen)
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant='destructive'
          disabled={!app || app.status === 'removing' || isDeleting}
        >
          {isDeleting ? (
            <IconLoader2 className='size-4 animate-spin' />
          ) : isProvisioning ? (
            <IconX className='size-4' />
          ) : (
            <IconTrash className='size-4' />
          )}
          {isProvisioning ? 'Kill' : 'Delete'}
        </Button>
      </DialogTrigger>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>{isProvisioning ? `Kill provisioning for ${app?.name}?` : `Delete ${app?.name}?`}</DialogTitle>
          <DialogDescription>
            {isProvisioning
              ? 'This cancels setup and removes the partially created app.'
              : 'This removes the app from Rebroid.'}
          </DialogDescription>
        </DialogHeader>
        <AppActionDialogSummary
          icon={isProvisioning ? <IconX className='size-4' /> : <IconTrash className='size-4' />}
          title={settings.removeDataOnDelete ? 'Saved profile data will be deleted' : 'Saved profile data is preserved'}
          description={
            settings.removeDataOnDelete
              ? 'The app record and runtime resources are removed with its saved profile data.'
              : 'The app record and runtime resources are removed. Saved profile data is kept when possible.'
          }
          tone='destructive'
        />
        <DialogFooter>
          <Button
            variant='destructive'
            disabled={isDeleting}
            onClick={() => void handleDelete()}
          >
            {isDeleting ? (
              <>
                <IconLoader2 className='size-4 animate-spin' />
                {isProvisioning ? 'Killing and deleting...' : 'Deleting...'}
              </>
            ) : isProvisioning ? (
              <>
                <IconX className='size-4' />
                Kill and delete
              </>
            ) : (
              <>
                <IconTrash className='size-4' />
                Delete
              </>
            )}
          </Button>
          <DialogClose asChild>
            <Button
              variant='secondary'
              disabled={isDeleting}
            >
              Cancel
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
