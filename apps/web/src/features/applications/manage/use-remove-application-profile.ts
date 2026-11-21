'use client'

import { useApplicationViewerContext } from '@/features/applications/detail/application-viewer-context'
import { toast } from '@/hooks/use-toast'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { deleteApplicationProfileAction } from '@/server/orchestrator/applications/actions/lifecycle/lifecycle-actions'
import { unwrapActionResult } from '@/shared/actions/action-result'

export const useRemoveApplicationProfile = () => {
  const { app, setApp } = useApplicationViewerContext()

  return async (profileName: string) => {
    if (!app) return
    try {
      unwrapActionResult(await deleteApplicationProfileAction(app.id, profileName))
    } catch (error) {
      toast({ title: 'Could not remove profile', description: getDisplayErrorMessage(error), variant: 'danger' })
      throw error
    }

    setApp(current => {
      if (current?.id !== app.id || current.savedProfiles !== app.savedProfiles) return current
      return {
        ...current,
        savedProfiles: current.savedProfiles.filter(
          profile => profile.mode !== 'persistent' || profile.name !== profileName
        )
      }
    })
    toast({
      title: 'Profile removed',
      description: `${profileName} was deleted with its saved data.`,
      variant: 'success'
    })
  }
}
