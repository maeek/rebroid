'use client'

import { useState } from 'react'
import { IconTrash, IconX } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ConfirmMutationDialog } from '@/components/ui/confirm-mutation-dialog'
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
        title: isProvisioning ? 'Could not cancel app provisioning' : 'Could not delete app',
        description: getDisplayErrorMessage(error),
        variant: 'danger'
      })
      setIsDeleting(false)
    }
  }

  return (
    <>
      <Button
        variant='danger'
        disabled={!app || app.status === 'removing' || isDeleting}
        onClick={() => setOpen(true)}
      >
        {isProvisioning ? <IconX className='size-4' /> : <IconTrash className='size-4' />}
        {isProvisioning ? 'Cancel provisioning' : 'Delete app'}
      </Button>
      <ConfirmMutationDialog
        open={open}
        title={isProvisioning ? `Cancel provisioning for ${app?.name}?` : `Delete ${app?.name}?`}
        description={
          isProvisioning
            ? 'This cancels setup and removes the partially created app.'
            : 'This permanently removes the app from Rebroid.'
        }
        summary={app?.name}
        consequence={
          settings.removeDataOnDelete
            ? 'Saved profile data, the app record, and runtime resources will be deleted.'
            : 'The app record and runtime resources will be deleted. Saved profile data is preserved when possible.'
        }
        confirmLabel={isProvisioning ? 'Cancel and delete' : 'Delete app'}
        pendingLabel={isProvisioning ? 'Cancelling…' : 'Deleting…'}
        pending={isDeleting}
        onOpenChange={setOpen}
        onConfirm={() => void handleDelete()}
      />
    </>
  )
}
