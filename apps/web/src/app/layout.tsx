import { CSSProperties } from 'react'
import localFont from 'next/font/local'
import { headers } from 'next/headers'
// eslint-disable-next-line import/order
import Providers from './providers'
// eslint-disable-next-line import/order
import type { Metadata, Viewport } from 'next'
import NextTopLoader from 'nextjs-toploader'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/toaster'
import { getServerAuthSession } from '@/server/auth/auth'
import { getAccentColorDataAttribute } from '@/shared/model/theme/accent-color'
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
  initialScale: 1,
  interactiveWidget: 'resizes-content',
  themeColor: '#111827'
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerAuthSession()
  const nonce = (await headers()).get('x-nonce') ?? undefined

  return (
    <html
      lang='en'
      dir='ltr'
      suppressHydrationWarning
      className={ubuntu.className}
      data-accent={getAccentColorDataAttribute(session?.user?.accentColor)}
      style={
        {
          '--font-ubuntu': ubuntu.style.fontFamily
        } as CSSProperties
      }
    >
      <body>
        <div className='root'>
          <ThemeProvider
            attribute='class'
            defaultTheme='dark'
            enableSystem
            themes={['light', 'dark', 'oled']}
            disableTransitionOnChange
            nonce={nonce}
          >
            <NextTopLoader
              color='hsl(var(--primary))'
              height={2}
              showSpinner={false}
              shadow={false}
              template='<div class="bar" role="bar"></div>'
              zIndex={9999}
            />
            <div id='modal-root' />
            <Providers>{children}</Providers>
            <Toaster />
          </ThemeProvider>
        </div>
      </body>
    </html>
  )
}
