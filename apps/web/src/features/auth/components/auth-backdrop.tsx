'use client'

import dynamic from 'next/dynamic'

const PixelBlast = dynamic(() => import('@/components/ui/pixel-blast'), {
  ssr: false
})
const AndroidLogo3D = dynamic(() => import('@/components/ui/android-logo-3d').then(mod => mod.AndroidLogo3D), {
  ssr: false
})

export const AuthBackdrop = () => (
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
)
