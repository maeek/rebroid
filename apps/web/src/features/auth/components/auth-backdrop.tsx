'use client'

import dynamic from 'next/dynamic'

const PixelBlast = dynamic(() => import('@/components/ui/pixel-blast'), {
  ssr: false
})
const AndroidLogo3D = dynamic(() => import('@/components/ui/android-logo-3d').then(mod => mod.AndroidLogo3D), {
  ssr: false
})

export const AuthBackdrop = () => (
  <div className='pointer-events-none fixed inset-0 flex h-dvh w-screen items-end justify-center overflow-hidden opacity-40 oled:hidden'>
    <div className='absolute inset-0 h-full w-full'>
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
    <div className='absolute inset-x-0 bottom-[-1px] flex items-end justify-center overflow-hidden lg:bg-[radial-gradient(#29573c7a,transparent)]'>
      <AndroidLogo3D className='auth-android-enter block w-[min(92vw,1600px)] max-w-none translate-y-px' />
    </div>
  </div>
)
