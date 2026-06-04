import { IconDeviceMobileCog, IconPlus, IconRobot } from '@tabler/icons-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'

export function AutomationEmptyState() {
  return (
    <div className='px-6 py-12 max-sm:px-4'>
      <div className='flex min-h-[50vh] items-center justify-center rounded-lg px-8 py-12'>
        <div className='flex max-w-lg flex-col items-center gap-6 text-center'>
          <div className='relative flex size-28 items-center justify-center'>
            <div className='absolute inset-0 rounded-full bg-primary/10' />
            <div className='absolute size-20 rounded-full bg-secondary/80' />
            <IconRobot className='relative size-12 text-primary' />
            <IconDeviceMobileCog className='absolute -right-1 bottom-3 size-8 text-secondary-foreground' />
          </div>
          <div className='flex flex-col gap-2'>
            <h3 className='text-2xl font-medium'>No automations yet</h3>
            <p className='text-secondary-foreground'>
              Create your first Android automation, choose a target app when needed, and run it manually or on a
              schedule.
            </p>
          </div>
          <Link href='/automations/new'>
            <Badge
              variant='status'
              className='gap-2 px-4 py-2 text-sm hover:bg-primary/20'
            >
              <IconPlus className='size-4' />
              Create automation
            </Badge>
          </Link>
        </div>
      </div>
    </div>
  )
}
