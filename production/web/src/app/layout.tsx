import { CSSProperties } from 'react'
import localFont from 'next/font/local'
// eslint-disable-next-line import/order
import Providers from './providers'
// eslint-disable-next-line import/order
import type { Metadata, Viewport } from 'next'
import NextTopLoader from 'nextjs-toploader'
import { PwaRegister } from '@/components/pwa-register'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/toaster'
import { getServerAuthSession } from '@/server/auth/auth'
// eslint-disable-next-line import/order
import './globals.scss'
// eslint-disable-next-line import/order
import './globals.css'

const ubuntu = localFont({
  src: [
    {
      path: '../styles/fonts/Ubuntu-Light.ttf',
      weight: '300'
    },
    {
      path: '../styles/fonts/Ubuntu-Regular.ttf',
      weight: '400'
    },
    {
      path: '../styles/fonts/Ubuntu-Medium.ttf',
      weight: '500'
    },
    {
      path: '../styles/fonts/Ubuntu-Bold.ttf',
      weight: '700'
    }
  ]
})

export const metadata: Metadata = {
  title: 'Rebroid',
  description: 'Stop making me install your dumb apps on my phone!',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/rebroid-icon.svg',
    apple: '/rebroid-icon-192.png'
  },
  appleWebApp: {
    capable: true,
    title: 'Rebroid',
    statusBarStyle: 'black-translucent'
  }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 0.85,
  interactiveWidget: 'resizes-content',
  userScalable: false,
  themeColor: '#111827'
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerAuthSession()

  return (
    <html
      lang='en'
      dir='ltr'
      suppressHydrationWarning
      className={ubuntu.className}
      style={
        {
          '--font-ubuntu': ubuntu.style.fontFamily
        } as CSSProperties
      }
    >
      <body>
        <ThemeProvider
          attribute='class'
          defaultTheme='system'
          enableSystem
          disableTransitionOnChange
        >
          <NextTopLoader
            color='var(--primary)'
            height={2}
            showSpinner={false}
            shadow={false}
            template='<div class="bar" role="bar"></div>'
            zIndex={9999}
          />
          <div id='modal-root' />
          <PwaRegister />
          <Providers session={session}>{children}</Providers>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
