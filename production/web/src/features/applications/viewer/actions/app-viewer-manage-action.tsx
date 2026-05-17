'use client'

import { IconSettings } from '@tabler/icons-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export const AppViewerManageAction = ({ appId }: { appId?: string }) => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={`/app/${appId}/manage`}
          className='flex items-center justify-center'
        >
          <Button variant='secondary'>
            <IconSettings className='size-4' />
          </Button>
        </Link>
      </TooltipTrigger>
      <TooltipContent>Manage the App</TooltipContent>
    </Tooltip>
  )
}
