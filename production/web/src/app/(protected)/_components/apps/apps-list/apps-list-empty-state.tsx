import { IconBrandAndroid, IconPlus, IconServerBolt } from '@tabler/icons-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { AppsListTitle } from './apps-list-title'

export const AppsListEmptyState = () => {
  return (
    <>
      <div className='px-6 flex items-center justify-between gap-4 pt-2 pb-2 max-sm:px-4'>
        <AppsListTitle />
      </div>
      <div className='px-6 py-12 max-sm:px-4'>
        <div className='min-h-[50vh] flex items-center justify-center rounded-lg px-8 py-12'>
          <div className='flex flex-col items-center text-center max-w-lg gap-6'>
            <div className='relative size-28 flex items-center justify-center'>
              <div className='absolute inset-0 rounded-full bg-primary/10' />
              <div className='absolute size-20 rounded-full bg-secondary/80' />
              <IconBrandAndroid className='relative size-12 text-primary' />
              <IconServerBolt className='absolute -right-1 bottom-3 size-8 text-secondary-foreground' />
            </div>
            <div className='flex flex-col gap-2'>
              <h3 className='text-2xl font-medium'>No Android apps yet</h3>
              <p className='text-secondary-foreground'>
                Create your first isolated redroid app, upload an APK, and let the orchestrator start provisioning it.
              </p>
            </div>
            <Link href='/apps/create'>
              <Badge
                variant='status'
                className='px-4 py-2 text-sm gap-2 hover:bg-primary/20'
              >
                <IconPlus className='size-4' />
                Create new app
              </Badge>
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
