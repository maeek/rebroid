'use client'
import { useSearchParams } from 'next/navigation'
import { AppDefinition } from '../../constants'
import { AppViewerActions } from './_components/actions'
import { AppViewer } from './_components/android'
import { AppViewerHeading } from './_components/heading'
import { AppInfo } from './_components/info'
import { UpdateAlert } from './_components/update-alert'

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
          <UpdateAlert app={app} />
          <AppViewerActions app={app} />
          <AppInfo app={app} />
          {/* <div className='flex flex-col p-6 max-sm:p-4 w-full bg-card/60 bg-opacity-40 rounded-xl gap-4 hover:bg-card/50 border border-input'></div> */}
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
