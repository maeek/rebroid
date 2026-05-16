'use client'

import { PropsWithChildren } from 'react'
import { Session } from 'next-auth'
import { SessionProvider } from 'next-auth/react'
import { I18nextProvider } from 'react-i18next'
import i18nInstance from '@/lib/i18n/instance'

const Providers = ({ children, session }: PropsWithChildren<{ session: Session | null }>) => {
  return (
    <SessionProvider session={session}>
      <I18nextProvider
        i18n={i18nInstance}
        defaultNS='common'
      >
        {children}
      </I18nextProvider>
    </SessionProvider>
  )
}

export default Providers
