import {
  IconAlertTriangle,
  IconCheck,
  IconLoader2,
  IconPlayerPlayFilled,
  IconPlayerStopFilled,
  IconTrash
} from '@tabler/icons-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu'
import { Visible } from '@/components/ui/visible'
import { AppIcon } from '../app-icon'
import { useAppsListContext } from './apps-list-context'
import { getAppStatusLabel, isAppBusy } from './apps-list.utils'
import type { AppDefinition } from '@/app/(protected)/(standard)/constants'

export const AppsListItem = ({ app }: { app: AppDefinition }) => {
  const { deleteApp, isManaging, selectedIds, startApp, stopApp, toggleSelected } = useAppsListContext()
  const isSelected = selectedIds.has(app.id)
  const busy = isAppBusy(app)
  const itemStatus = getAppStatusLabel(app)

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        {isManaging ? (
          <button
            type='button'
            className='flex w-full flex-col items-center justify-center cursor-pointer gap-2 overflow-hidden rounded-lg border border-transparent p-2 transition hover:border-primary/30 hover:bg-primary/5 data-[selected=true]:border-primary/50 data-[selected=true]:bg-primary/10'
            data-selected={isSelected}
            onClick={() => toggleSelected(app.id)}
          >
            <div className='relative size-24 hover:saturate-150 transition-all hover:scale-95'>
              <span
                className='absolute left-1 top-1 z-20 flex size-5 items-center justify-center rounded-sm border border-primary bg-background text-primary data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground'
                data-selected={isSelected}
                aria-hidden='true'
              >
                <Visible when={isSelected}>
                  <IconCheck className='size-4' />
                </Visible>
              </span>
              <Visible when={app.running}>
                <>
                  <div className='absolute top-2 right-2 rounded-2xl size-4 bg-primary/95 z-10' />
                  <div className='absolute top-2 right-2 rounded-2xl size-4 bg-primary z-10 animate-ping duration-[2s]' />
                </>
              </Visible>
              <Visible when={app.status === 'error'}>
                <IconAlertTriangle className='absolute top-1 right-1 size-5 text-destructive z-10' />
              </Visible>
              <Visible when={busy}>
                <IconLoader2 className='absolute top-1 right-1 size-5 text-primary z-10 animate-spin' />
              </Visible>
              <AppIcon
                appId={app.id}
                appName={app.name}
                icon={app.icon}
                className='absolute top-[50%] left-[50%] translate-y-[-50%] translate-x-[-50%] size-20'
              />
            </div>
            <span className='text-sm text-ellipsis w-full text-nowrap overflow-hidden text-center lg:px-2'>
              {app.name}
            </span>
            <Badge
              variant={app.status === 'error' ? 'destructive' : 'secondary'}
              className='max-w-full text-[10px] capitalize'
            >
              {itemStatus}
            </Badge>
          </button>
        ) : (
          <Link href={`/app/${app.id}`}>
            <div className='flex flex-col items-center justify-center cursor-pointer gap-2 overflow-hidden p-2'>
              <div className='relative size-24 hover:saturate-150 transition-all hover:scale-95'>
                <Visible when={app.running}>
                  <>
                    <div className='absolute top-2 right-2 rounded-2xl size-4 bg-primary/95 z-10' />
                    <div className='absolute top-2 right-2 rounded-2xl size-4 bg-primary z-10 animate-ping duration-[2s]' />
                  </>
                </Visible>
                <Visible when={app.status === 'error'}>
                  <IconAlertTriangle className='absolute top-1 right-1 size-5 text-destructive z-10' />
                </Visible>
                <Visible when={busy}>
                  <IconLoader2 className='absolute top-1 right-1 size-5 text-primary z-10 animate-spin' />
                </Visible>
                <AppIcon
                  appId={app.id}
                  appName={app.name}
                  icon={app.icon}
                  className='absolute top-[50%] left-[50%] translate-y-[-50%] translate-x-[-50%] size-20'
                />
              </div>
              <span className='text-sm text-ellipsis w-full text-nowrap overflow-hidden text-center lg:px-2'>
                {app.name}
              </span>
              <Badge
                variant={app.status === 'error' ? 'destructive' : 'secondary'}
                className='max-w-full text-[10px] capitalize'
              >
                {itemStatus}
              </Badge>
            </div>
          </Link>
        )}
      </ContextMenuTrigger>
      <ContextMenuContent className='w-52'>
        {app.running ? (
          <ContextMenuItem
            disabled={app.status === 'removing'}
            onClick={() => void stopApp(app)}
          >
            <IconPlayerStopFilled /> Stop
          </ContextMenuItem>
        ) : (
          <ContextMenuItem
            disabled={busy}
            onClick={() => void startApp(app)}
          >
            <IconPlayerPlayFilled /> Run
          </ContextMenuItem>
        )}
        <ContextMenuItem
          inset
          disabled
        >
          Reset
        </ContextMenuItem>
        <ContextMenuItem
          variant='destructive'
          disabled={app.status === 'removing'}
          onClick={() => void deleteApp(app)}
        >
          <IconTrash className='text-destructive' />
          {app.status === 'provisioning' ? 'Cancel and delete' : 'Delete'}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
