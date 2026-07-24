'use client'

import dynamic from 'next/dynamic'

const AuthPixelBackdrop = dynamic(() => import('./auth-pixel-backdrop').then(module => module.AuthPixelBackdrop), {
  ssr: false
})

export const AuthBackdrop = () => (
  <div className='pointer-events-none fixed inset-0 h-dvh w-screen overflow-hidden opacity-40 oled:hidden'>
    <div className='absolute inset-0 h-full w-full'>
      <AuthPixelBackdrop />
    </div>
  </div>
)
