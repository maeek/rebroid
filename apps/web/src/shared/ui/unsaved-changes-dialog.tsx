'use client'

import { useRouter } from 'next/navigation'
import { ConfirmMutationDialog } from '@/components/ui/confirm-mutation-dialog'
import { useUnsavedNavigation } from '@/hooks/use-unsaved-navigation'

export const UnsavedChangesDialog = ({
  navigation,
  description = 'Your changes will be discarded if you leave this page.'
}: {
  navigation: Pick<
    ReturnType<typeof useUnsavedNavigation>,
    'confirmPendingNavigation' | 'pendingNavigation' | 'cancelPendingNavigation'
  >
  description?: string
}) => (
  <ConfirmMutationDialog
    open={Boolean(navigation.pendingNavigation)}
    title='Leave without saving?'
    description={description}
    tone='warning'
    cancelLabel='Keep editing'
    confirmLabel='Leave page'
    onConfirm={navigation.confirmPendingNavigation}
    onOpenChange={open => {
      if (!open) navigation.cancelPendingNavigation()
    }}
  />
)

export const UnsavedChangesGuard = ({
  dirty,
  preservesDraft,
  onDiscard
}: {
  dirty: boolean
  onDiscard: () => void
  preservesDraft?: (destination: URL, current: URL) => boolean
}) => {
  const router = useRouter()
  const navigation = useUnsavedNavigation({ hasUnsavedChanges: dirty, push: router.push, preservesDraft, onDiscard })
  return <UnsavedChangesDialog navigation={navigation} />
}
