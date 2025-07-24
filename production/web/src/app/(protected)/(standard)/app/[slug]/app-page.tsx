'use client'
import { IconLoader2 } from '@tabler/icons-react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Section } from '@/components/ui/section'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { AppViewerActions } from '../../../_components/viewer/actions'
import { AppViewer } from '../../../_components/viewer/android'
import { AppViewerHeading } from '../../../_components/viewer/heading'
import { AppInfo } from '../../../_components/viewer/info'
import { AppUpdateAlert } from '../../../_components/viewer/update-alert'
import { AppDefinition } from '../../constants'

export const AppViewerPage = ({ app }: { app?: AppDefinition }) => {
  const params = useSearchParams()

  return (
    <div className='pl-72 max-lg:pl-0 min-h-full h-[calc(100vh-4rem)] max-sm:w-full'>
      <div
        className='w-screen h-screen bg-primary/80 blur-3xl fixed top-0 left-0 z-[-10] pointer-events-none'
        style={{
          backgroundImage: `url("https://static.suchanecki.me/${app?.icon}")`,
          backgroundSize: '1000% 1000%',
          backgroundPosition: 'top left',
          opacity: 0.05
        }}
      />
      <main className='row-layout max-w-[1200px] mx-auto flex h-full justify-between gap-8 max-sm:flex-col max-sm:items-center'>
        <div className='px-6 w-full flex items-start gap-4 pt-2 pb-2 max-sm:px-4 flex-col'>
          <AppViewerHeading app={app}>
            <AppViewerActions app={app} />
          </AppViewerHeading>
          <Section
            className='flex flex-row bg-primary/10 border border-primary/20 hover:bg-primary/20 py-3 px-4'
            orientation='horizontal'
          >
            <IconLoader2 className='size-6 animate-spin text-primary mr-4' />
            <span className='text-foreground font-light'>Establishing connection</span>
          </Section>
          <AppUpdateAlert app={app} />
          <AppInfo app={app} />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                className='w-full'
                variant='secondary'
                onClick={() => {
                  // Toggles hideOutline searchParam
                  const url = new URL(window.location.href)
                  const currentHideOutline = url.searchParams.get('hideOutline') === 'true'
                  url.searchParams.set('hideOutline', String(!currentHideOutline))
                  window.history.replaceState({}, '', url.toString())
                }}
              >
                Toggle Outline
              </Button>
            </TooltipTrigger>
            <TooltipContent>Toggle the device mockup outline</TooltipContent>
          </Tooltip>
          <div className='w-full flex items-center justify-center gap-2 font-black mt-4 text-secondary-foreground text-lg md:hidden select-none'>
            <div>•</div>
            <div>•</div>
            <div>•</div>
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
