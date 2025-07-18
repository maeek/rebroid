'use client'
import { Button } from '@/components/ui/button'
import { AppDefinition } from '../../constants'
import { AppViewer } from './_components/android'
import { AppViewerHeading } from './_components/heading'
import { useSearchParams } from 'next/navigation'

export const ViewerPage = ({ app }: { app?: AppDefinition }) => {
  const params = useSearchParams()

  return (
    <div className='pl-72 max-lg:pl-0 min-h-full h-[calc(100vh-4rem)] max-sm:w-full'>
      <div
        className='w-[100vw] h-[100vh] bg-primary/80 blur-3xl fixed top-0 left-0 z-[-1] pointer-events-none'
        style={{
          backgroundImage: `url("https://static.suchanecki.me/${app?.icon}")`,
          backgroundSize: '1000% 1000%',
          backgroundPosition: 'top left',
          opacity: 0.05
        }}
      />
      <main className='row-layout max-w-[1600px] mx-auto flex h-full justify-between gap-8 max-sm:flex-col max-sm:items-center'>
        <div className='px-6 w-full flex items-start gap-4 pt-2 pb-2 max-sm:px-4 flex-col'>
          <AppViewerHeading app={app} />
          <div className='flex flex-col bg-card/60 bg-opacity-40 p-8 max-sm:p-4 w-full rounded-xl mt-6 max-sm:mt-0 gap-4 hover:bg-card/50'>
            <div className='flex justify-between text-secondary-foreground'>
              <div>Last accessed</div>
              <div>now</div>
            </div>
            <div className='flex justify-between text-secondary-foreground'>
              <div>App version</div>
              <div>
                1.4.3&nbsp;&nbsp;•&nbsp;&nbsp;<span className='text-primary cursor-pointer'>Update available</span>
              </div>
            </div>
          </div>
          <div className='flex bg-card/60 bg-opacity-40 p-4 w-full min-h-16 rounded-xl gap-2 flex-wrap hover:bg-card/50'>
            <Button variant='secondary'>Manage</Button>
            <Button
              variant='secondary'
              onClick={() => {
                // Toggles hideOutline searchParam
                const url = new URL(window.location.href)
                const currentHideOutline = url.searchParams.get('hideOutline') === 'true'
                url.searchParams.set('hideOutline', String(!currentHideOutline))
                window.history.replaceState({}, '', url.toString())
              }}
            >
              Toggle phone outline
            </Button>
            <Button variant='secondary'>Restart</Button>
          </div>
        </div>
        <div className='w-auto h-full max-h-[calc(100vh-4rem)] flex justify-end lg:pr-4 lg:pt-6 items-start max-sm:items-center max-sm:justify-center max-sm:w-max'>
          <AppViewer
            app={app}
            hideOutline={params.get('hideOutline') === 'true'}
          />
        </div>
      </main>
    </div>
  )
}
