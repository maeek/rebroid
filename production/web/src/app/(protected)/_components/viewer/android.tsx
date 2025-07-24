'use client'
import Android from '@/components/ui/android'
import { useMediaQuery, useScreenWidth } from '@/hooks/use-media-query'
import { AppDefinition } from '../../(standard)/constants'

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
      </div>
    </>
  )

  if (hideOutline) {
    return (
      <div className='flex flex-col items-center w-full h-full min-w-[calc(433px*1)] flex-1 lg:h-[calc(882px*1)] max-sm:min-w-screen max-sm:min-h-[calc(100vh-4rem)] relative rounded-lg overflow-hidden'>
        {content}
      </div>
    )
  }

  return <Android width={isMobile ? (width ?? 100) - 64 : undefined}>{content}</Android>
}
