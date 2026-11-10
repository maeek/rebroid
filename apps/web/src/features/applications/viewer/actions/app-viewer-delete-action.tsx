'use client'

import { useState, type ReactNode } from 'react'
import { IconTrash, IconX } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ConfirmMutationDialog } from '@/components/ui/confirm-mutation-dialog'
import { toast } from '@/hooks/use-toast'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { requestApplicationDeletionAction } from '@/server/orchestrator/applications/actions/lifecycle/lifecycle-actions'
import { unwrapActionResult } from '@/shared/actions/action-result'
import { notifyRecentAppsUpdated } from '@/shared/model/recent-apps/recent-apps'
import { useOrchestratorUiSettings } from '@/shared/model/settings/use-orchestrator-ui-settings'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { OrchestratorUiSettings } from '@/shared/model/settings/use-orchestrator-ui-settings'

export const AppViewerDeleteAction = ({
  app,
  initialSettings,
  renderTrigger
}: {
  app?: AppDefinition
  initialSettings: OrchestratorUiSettings
  renderTrigger?: (trigger: { disabled: boolean; label: string; onClick: () => void }) => ReactNode
}) => {
  const [open, setOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const router = useRouter()
  const settings = useOrchestratorUiSettings(initialSettings, { refreshOnMount: false })
  const isProvisioning = app?.status === 'provisioning'
  const trigger = {
    disabled: !app || app.status === 'removing' || isDeleting,
    label: isProvisioning ? 'Cancel provisioning' : 'Delete app',
    onClick: () => setOpen(true)
  }

  const handleDelete = async () => {
    if (!app) {
      return
    }

    setIsDeleting(true)
    try {
      unwrapActionResult(await requestApplicationDeletionAction(app.id, settings.removeDataOnDelete))
      notifyRecentAppsUpdated()
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
      {renderTrigger ? (
        renderTrigger(trigger)
      ) : (
        <Button
          variant='danger'
          disabled={trigger.disabled}
          onClick={trigger.onClick}
        >
          {isProvisioning ? <IconX className='size-4' /> : <IconTrash className='size-4' />}
          {trigger.label}
        </Button>
      )}
      <ConfirmMutationDialog
        open={open}
        title={isProvisioning ? `Cancel provisioning for ${app?.name}?` : `Delete ${app?.name}?`}
        description={
          isProvisioning
            ? 'Setup will stop and the partially created app will be removed.'
            : 'The app and its runtime resources will be permanently removed from Rebroid.'
        }
        consequence={
          settings.removeDataOnDelete
            ? 'Saved profile data will also be deleted.'
            : 'Saved profile data is preserved when possible.'
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
