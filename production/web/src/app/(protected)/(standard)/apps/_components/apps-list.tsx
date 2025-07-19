'use client'
import { IconPlayerPlayFilled, IconPlayerStopFilled, IconTrash } from '@tabler/icons-react'
import Link from 'next/link'
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu'

export interface AppItem {
  id: string
  name: string
  icon: string
  running: boolean
}

export const AppsList = ({ yourApps }: { yourApps: AppItem[] }) => {
  const sortedApps = yourApps.toSorted((a, b) => {
    if (a.running && !b.running) return -1
    if (!a.running && b.running) return 1
    return a.name.localeCompare(b.name)
  })
  const runningApps = sortedApps.filter(app => app.running)
  const availableApps = sortedApps.filter(app => !app.running)

  const itemRenderer = (item: AppItem) => (
    <ContextMenu key={item.id}>
      <ContextMenuTrigger>
        <Link href={`/app/${item.id}`}>
          <div className='flex flex-col items-center justify-center cursor-pointer gap-2 overflow-hidden'>
            <div className='relative w-24 h-24 hover:saturate-150 transition-all hover:scale-95'>
              {item.running && (
                <>
                  <div className='absolute top-2 right-2 rounded-2xl w-4 h-4 bg-primary/95 z-10'></div>
                  <div className='absolute top-2 right-2 rounded-2xl w-4 h-4 bg-primary z-10 animate-ping duration-[2s]'></div>
                </>
              )}
              <div
                className='absolute top-[50%] left-[50%] translate-y-[-50%] translate-x-[-50%] w-20 h-20 bg-slate-400/20 flex items-center justify-center transition-all'
                style={{
                  clipPath: `url(#squircleClip)`,
                  backgroundImage: `url("https://static.suchanecki.me/${item.icon}")`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center'
                }}
              ></div>
            </div>
            <span className='text-sm text-ellipsis w-full text-nowrap overflow-hidden text-center lg:px-2'>
              {item.name}
            </span>
          </div>
        </Link>
      </ContextMenuTrigger>
      <ContextMenuContent className='w-52'>
        {item.running ? (
          <ContextMenuItem>
            <IconPlayerStopFilled /> Stop
          </ContextMenuItem>
        ) : (
          <ContextMenuItem>
            <IconPlayerPlayFilled /> Run
          </ContextMenuItem>
        )}
        <ContextMenuItem inset>Reset</ContextMenuItem>
        <ContextMenuItem variant='destructive'>
          <IconTrash className='text-destructive' />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )

  return (
    <>
      <h3 className='font-medium text-secondary-foreground flex pt-2 px-6 text-md items-center justify-between'>
        Running ( {yourApps.filter(app => app.running).length} )
      </h3>
      <div className='grid gap-x-5 gap-y-12 py-4 px-2 grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-7'>
        {runningApps.map(itemRenderer)}
      </div>
      <h3 className='font-medium text-secondary-foreground flex pt-6 px-6 text-md'>Available</h3>
      <div className='grid gap-x-5 gap-y-12 py-4 px-2 grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-7'>
        {availableApps.map(itemRenderer)}
      </div>
    </>
  )
}
