'use client'

import { IconCopy, IconLoader2 } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Visible } from '@/components/ui/visible'
import { toast } from '@/hooks/use-toast'
import { requestApplicationCloneAction } from '@/server/orchestrator/applications/actions/lifecycle/clone-actions'
import { unwrapActionResult } from '@/shared/actions/action-result'
import { useAppViewerActionRunner } from './use-app-viewer-action-runner'
import type { AppDefinition } from '@/features/applications/domain/app-definition'

type AppViewerOpenAsMeActionProps = {
  app?: AppDefinition
}

export const AppViewerOpenAsMeAction = ({ app }: AppViewerOpenAsMeActionProps) => {
  const router = useRouter()
  const { isRunningAction, runAction } = useAppViewerActionRunner()

  return (
    <Button
      variant='primary'
      disabled={!app || isRunningAction}
      onClick={() => {
        if (!app) {
          return
        }

        void runAction(async () => {
          const cloned = unwrapActionResult(await requestApplicationCloneAction(app.id))
          toast({
            title: 'Opening your own copy',
            description: 'A separate app session is being prepared for your profile.'
          })
          router.push(`/app/${cloned.id}`)
        }, 'Could not open app as your copy')
      }}
    >
      <Visible when={isRunningAction}>
        <IconLoader2 className='size-4 animate-spin' />
      </Visible>
      <Visible when={!isRunningAction}>
        <IconCopy className='size-4' />
      </Visible>
      Open as me
    </Button>
  )
}
