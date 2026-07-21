import type { ReactNode } from 'react'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getAuthenticatedUser } from '@/server/auth/authorization'
import { passwordChangeRedirectPath } from '@/server/auth/password-change-routing'
import { loadFeatureFlags } from '@/server/orchestrator/features'
import { FeatureFlagsProvider } from '@/shared/model/features/feature-flags-context'

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const [user, requestHeaders, featureFlags] = await Promise.all([
    getAuthenticatedUser(),
    headers(),
    loadFeatureFlags()
  ])
  const pathname = requestHeaders.get('x-pathname') ?? ''
  const redirectPath = passwordChangeRedirectPath({
    passwordChangeRequired: user.passwordChangeRequired,
    pathname
  })

  if (redirectPath) {
    redirect(redirectPath)
  }

  return <FeatureFlagsProvider manifest={featureFlags}>{children}</FeatureFlagsProvider>
}
