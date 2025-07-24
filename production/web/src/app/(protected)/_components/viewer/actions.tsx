import { IconSettings, IconRestore } from '@tabler/icons-react'
import classNames from 'classnames'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { AppDefinition } from '../../(standard)/constants'

export const AppViewerActions = ({ className, app }: { app?: AppDefinition; className?: string }) => {
  return (
    <div className={classNames('flex flex-row gap-2 items-center', className)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={`/app/${app?.id}/manage`}
            className='flex items-center justify-center'
          >
            <Button variant='secondary'>
              <IconSettings className='size-4' />
            </Button>
          </Link>
        </TooltipTrigger>
        <TooltipContent>Manage the App</TooltipContent>
      </Tooltip>
      <Dialog modal>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button variant='secondary'>
                <IconRestore className='size-4' /> Restart
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent>Restart</TooltipContent>
        </Tooltip>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restart {app?.name}?</DialogTitle>
            <DialogDescription>
              This action will kill the docker container and start it with configured settings. Do you wish to continue?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant='destructive'>Restart</Button>
            <DialogTrigger asChild>
              <Button variant='secondary'>Cancel</Button>
            </DialogTrigger>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Button variant='destructive'>Stop</Button>
    </div>
  )
}
