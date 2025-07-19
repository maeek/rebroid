'use client'
import Android from '@/components/ui/android'
import { useMediaQuery, useScreenWidth } from '@/hooks/use-media-query'
import { AppDefinition } from '../../../constants'

export const AppViewer = ({ hideOutline }: { app?: AppDefinition; hideOutline?: boolean }) => {
  const width = useScreenWidth()
  const isMobile = useMediaQuery('(max-width: 768px)')

  const content = (
    <>
      <div
        className={`${hideOutline ? '' : 'p-2'} bg-card w-full h-[calc(100%+0.5rem)] flex items-center justify-center`}
      >
        <iframe
          src='http://localhost:8000/#!action=stream&udid=R3CR900B0WV&player=mse&ws=ws%3A%2F%2Flocalhost%3A8000%2F%3Faction%3Dproxy-adb%26remote%3Dtcp%253A8886%26udid%3DR3CR900B0WV'
          className='w-full h-full rounded-lg'
        />
        {/* {app?.icon && (
          <div className='relative w-32 h-32 flex items-center justify-center flex-col'>
            <div
              className='w-24 h-24 bg-primary/80 rounded-[50%] animate-ping origin-center delay-500 blur-xl'
              style={{
                backgroundImage: `url("https://static.suchanecki.me/${app?.icon}")`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                opacity: 0.7
              }}
            />
            <div
              className='absolute top-[1.6rem] left-[1.6rem] w-20 h-20 bg-slate-400/20 flex items-center justify-center transition-all animate-bounce'
              style={{
                clipPath: `url(#squircleClip)`,
                backgroundImage: `url("https://static.suchanecki.me/${app?.icon}")`,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              }}
            />
          </div>
        )} */}
      </div>
      {/* <div className='absolute bottom-8 left-1/2 transform -translate-x-1/2 text-center pointer-events-none'>
        <h3 className='mt-2'>Establishing connection...</h3>
      </div> */}
    </>
  )

  if (hideOutline) {
    return (
      <div className='flex flex-col items-center w-full h-full min-w-[calc(433px*1)] flex-1 lg:h-[calc(882px*1)] max-sm:min-w-[100vw] max-sm:min-h-[calc(100vh-4rem)] relative rounded-lg overflow-hidden'>
        {content}
      </div>
    )
  }

  return <Android width={isMobile ? (width ?? 100) - 64 : undefined}>{content}</Android>
}
