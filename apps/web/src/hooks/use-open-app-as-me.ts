'use client'

import { useRouter } from 'next/navigation'
import { toast } from '@/hooks/use-toast'
import { requestApplicationCloneAction } from '@/server/orchestrator/applications/actions/lifecycle/clone-actions'
import { unwrapActionResult } from '@/shared/actions/action-result'
import { useApplicationActionRunner } from './use-application-action-runner'

export const useOpenAppAsMe = () => {
  const router = useRouter()
  const { isRunningAction, runAction } = useApplicationActionRunner()

  const openAppAsMe = (appId: string, onOpened?: () => void) =>
    runAction(async () => {
      const cloned = unwrapActionResult(await requestApplicationCloneAction(appId))
      toast({
        title: 'Opening your own copy',
        description: 'A separate app session is being prepared for your profile.'
      })
      router.push(`/app/${cloned.id}`)
      onOpened?.()
    }, 'Could not open app as your copy')

  return { isCloning: isRunningAction, openAppAsMe }
}
