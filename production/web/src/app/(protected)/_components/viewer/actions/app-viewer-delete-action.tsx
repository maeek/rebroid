'use client'

import { useState } from 'react'
import { IconTrash } from '@tabler/icons-react'
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
import { toast } from '@/hooks/use-toast'
import { removeAppIconAction } from '@/lib/app-icons/actions'
import { deleteApplicationAction } from '@/lib/orchestrator/actions'
import { useOrchestratorUiSettings } from '@/lib/orchestrator/settings'
import type { AppDefinition } from '../../../(standard)/constants'

export const AppViewerDeleteAction = ({ app }: { app?: AppDefinition }) => {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const settings = useOrchestratorUiSettings()

  const handleDelete = async () => {
    if (!app) {
      return
    }

    try {
      await deleteApplicationAction(app.id, settings.removeDataOnDelete)
      await removeAppIconAction(app.id)
      setOpen(false)
      router.push('/apps')
    } catch (error) {
      toast({ title: 'Could not delete app', description: error instanceof Error ? error.message : 'Unknown error' })
    }
  }

  return (
    <Dialog
      modal
      open={open}
      onOpenChange={setOpen}
    >
      <DialogTrigger asChild>
        <Button
          variant='destructive'
          disabled={!app || app.status === 'removing'}
        >
          <IconTrash className='size-4' />
          {app?.status === 'provisioning' ? 'Cancel' : 'Delete'}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{app?.status === 'provisioning' ? 'Cancel provisioning?' : `Delete ${app?.name}?`}</DialogTitle>
          <DialogDescription>
            This will force-remove the managed container resources, delete preserved data, and remove the application
            record.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant='destructive'
            onClick={() => void handleDelete()}
          >
            {app?.status === 'provisioning' ? 'Cancel and delete' : 'Delete'}
          </Button>
          <DialogClose asChild>
            <Button variant='secondary'>Keep app</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
