'use client'

import dynamic from 'next/dynamic'

const AuthFlowBackdrop = dynamic(() => import('./auth-flow-backdrop').then(module => module.AuthFlowBackdrop), {
  ssr: false
})

export const AuthBackdrop = () => (
  <div
    aria-hidden='true'
    className='pointer-events-none absolute inset-0 -z-10 overflow-hidden opacity-40 dark:opacity-60 oled:opacity-40'
  >
    <AuthFlowBackdrop />
  </div>
)
