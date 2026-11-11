import { redirect } from 'next/navigation'
import { AuthPage } from '@/features/auth/components/auth-page'
import { getAuthenticatedUser } from '@/server/auth/authorization'
import { getWebSettings } from '@/server/web-settings/store'
import { RequiredPasswordChangePageClient } from './page-client'

export const RequiredPasswordChangePageEntry = async () => {
  const [user, settings] = await Promise.all([getAuthenticatedUser(), getWebSettings()])

  if (!user.passwordChangeRequired) {
    redirect('/apps')
  }

  return (
    <AuthPage>
      <RequiredPasswordChangePageClient
        displayName={user.name || user.username}
        username={user.username}
        passwordMinimumLength={settings.passwordMinimumLength}
      />
    </AuthPage>
  )
}

export const RequiredPasswordChangePageLoadingEntry = () => (
  <AuthPage>
    <RequiredPasswordChangePageClient loading />
  </AuthPage>
)
