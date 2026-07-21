'use client'

import dynamic from 'next/dynamic'
import Image from 'next/image'

const AuthPixelBackdrop = dynamic(() => import('./auth-pixel-backdrop').then(module => module.AuthPixelBackdrop), {
  ssr: false
})

export const AuthBackdrop = () => (
  <div className='pointer-events-none fixed inset-0 flex h-dvh w-screen items-end justify-center overflow-hidden opacity-40 oled:hidden'>
    <div className='absolute inset-0 h-full w-full'>
      <AuthPixelBackdrop />
    </div>
    <div className='absolute inset-x-0 bottom-[-1px] flex items-end justify-center overflow-hidden'>
      <Image
        src='/auth-android-backdrop.svg'
        alt=''
        aria-hidden='true'
        width={430}
        height={252}
        sizes='min(92vw, 1600px)'
        className='auth-android-enter block h-auto w-[min(92vw,1600px)] max-w-none translate-y-px'
        priority
      />
    </div>
  </div>
)
