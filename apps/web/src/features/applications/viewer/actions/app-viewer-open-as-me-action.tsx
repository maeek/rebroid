'use client'

import { IconCopy } from '@tabler/icons-react'
import { MutationButton } from '@/components/ui/mutation-button'
import { useOpenAppAsMe } from '@/hooks/use-open-app-as-me'
import type { AppDefinition } from '@/features/applications/domain/app-definition'

type AppViewerOpenAsMeActionProps = {
  app?: AppDefinition
}

export const AppViewerOpenAsMeAction = ({ app }: AppViewerOpenAsMeActionProps) => {
  const { isCloning, openAppAsMe } = useOpenAppAsMe()

  return (
    <MutationButton
      variant='primary'
      disabled={!app}
      pending={isCloning}
      pendingLabel='Opening…'
      onClick={() => {
        if (app) void openAppAsMe(app.id)
      }}
    >
      <IconCopy className='size-4' />
      Open as me
    </MutationButton>
  )
}
