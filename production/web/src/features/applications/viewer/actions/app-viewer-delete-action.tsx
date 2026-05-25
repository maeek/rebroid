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
import { forgetRecentApp } from '@/features/applications/recent/recent-apps'
import { useOrchestratorUiSettings } from '@/features/settings/hooks/use-orchestrator-ui-settings'
import { toast } from '@/hooks/use-toast'
import { removeAppIconAction } from '@/server/app-icons/actions/remove-app-icon-action'
import { deleteApplicationAction } from '@/server/orchestrator/applications/mutation-actions'
import { getDisplayErrorMessage } from '../../../../lib/error-utils'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { OrchestratorUiSettings } from '@/features/settings/hooks/use-orchestrator-ui-settings'

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
      await removeAppIconAction(app.id)
      forgetRecentApp(app.id)
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isProvisioning ? `Kill provisioning for ${app?.name}?` : `Delete ${app?.name}?`}</DialogTitle>
          <DialogDescription>
            {isProvisioning
              ? 'This will stop setup, delete preserved data, and remove the app.'
              : 'This will stop the app, delete preserved data, and remove it.'}
          </DialogDescription>
        </DialogHeader>
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
