import { Button } from '@/components/ui/button'
import { AppsList } from './_components/apps-list'
import { yourApps } from '../constants'

export default function Apps() {
  return (
    <div className='pl-72 max-lg:pl-0 min-h-full'>
      <main className='row-layout max-w-[1600px] mx-auto'>
        <div className='px-6 flex items-center justify-between gap-4 pt-2 pb-2 max-sm:px-4'>
          <div className='text-3xl max-sm:text-xl font-medium flex-shrink-0'>Installed Apps</div>
          <Button variant='ghost'>Manage</Button>
        </div>
        <AppsList yourApps={yourApps} />
      </main>
    </div>
  )
}
