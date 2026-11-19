'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { ConfirmMutationDialog } from '@/components/ui/confirm-mutation-dialog'
import { FormField } from '@/components/ui/form-field'
import {
  useContainerDetailContext,
  useContainerDetailControllerContext
} from '@/features/platform/details/runtime-container-detail/container-detail-context'
import {
  actionDialogCopy,
  getActionButtonLabel
} from '@/features/platform/details/runtime-container-detail/container-detail-utils'

export const ContainerActionDialog = () => {
  const { details } = useContainerDetailContext()
  const { closeActionDialog, forceRemove, isActing, pendingAction, runAction, setForceRemove } =
    useContainerDetailControllerContext()
  const container = details.container
  const action = pendingAction ?? 'remove'
  const copy = actionDialogCopy[action]

  return (
    <ConfirmMutationDialog
      open={Boolean(pendingAction)}
      title={`${copy.verb} “${container.names[0] ?? container.shortId}”?`}
      description={copy.description}
      tone={action === 'stop' ? 'warning' : 'danger'}
      confirmLabel={getActionButtonLabel(action, forceRemove)}
      pending={isActing}
      pendingLabel={action === 'stop' ? 'Stopping…' : 'Removing…'}
      onConfirm={() => void runAction()}
      onOpenChange={open => {
        closeActionDialog(open)
        if (!open) {
          setForceRemove(container.state === 'removing')
        }
      }}
    >
      {pendingAction === 'remove' ? (
        <FormField
          layout='horizontal'
          label='Force removal'
          description='Use if normal removal fails or Docker is stuck removing the container.'
        >
          <Checkbox
            checked={forceRemove}
            onCheckedChange={checked => setForceRemove(checked === true)}
            disabled={isActing}
          />
        </FormField>
      ) : null}
    </ConfirmMutationDialog>
  )
}
