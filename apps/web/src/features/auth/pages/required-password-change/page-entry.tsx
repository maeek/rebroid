import { redirect } from 'next/navigation'
import { AuthBackdrop } from '@/features/auth/components/auth-backdrop'
import { getCurrentUser } from '@/server/auth/authorization'
import { getWebSettings } from '@/server/web-settings/store'
import { RequiredPasswordChangePageClient } from './page-client'

export const RequiredPasswordChangePageEntry = async () => {
  const [user, settings] = await Promise.all([getCurrentUser(), getWebSettings()])

  if (!user.passwordChangeRequired) {
    redirect('/apps')
  }

  return (
    <main className='relative flex min-h-dvh w-full items-center justify-center overflow-hidden px-5 py-10'>
      <AuthBackdrop />
      <RequiredPasswordChangePageClient
        displayName={user.name || user.username}
        passwordMinimumLength={settings.passwordMinimumLength}
      />
    </main>
  )
}
