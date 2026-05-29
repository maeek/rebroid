import { AndroidLogo3D } from '@/components/ui/android-logo-3d'
import PixelBlast from '@/components/ui/pixel-blast'
import { TopBarUnprotected } from '@/features/auth/components/top-bar'

export default function FilesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className='flex flex-col w-full h-full relative'>
      <div className='pointer-events-none absolute top-0 left-0 inset-0 opacity-40 overflow-hidden max-w-screen flex items-end justify-center w-full h-full'>
        <div className='w-full h-full'>
          <PixelBlast
            className='w-full h-full'
            variant='square'
            pixelSize={5}
            color='#34A853'
            patternScale={4}
            patternDensity={1}
            pixelSizeJitter={0.75}
            enableRipples={false}
            liquid={false}
            speed={1.35}
            edgeFade={0.38}
            transparent
          />
        </div>
        <div className='absolute top-unset bottom-0 inset-0 overflow-hidden max-w-screen flex items-end justify-center lg:bg-[radial-gradient(#29573c7a,transparent)]'>
          <AndroidLogo3D className='max-w-400' />
        </div>
      </div>

      <TopBarUnprotected />
      <div className='h-full w-full grow'>{children}</div>
    </div>
  )
}
