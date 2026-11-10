import type { ReactNode } from 'react'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { getAuthenticatedUser } from '@/server/auth/authorization'
import { passwordChangeRedirectPath } from '@/server/auth/password-change-routing'
import { loadFeatureFlags } from '@/server/orchestrator/features'
import { FeatureFlagsProvider } from '@/shared/model/features/feature-flags-context'

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  await connection()
  const [user, requestHeaders] = await Promise.all([getAuthenticatedUser(), headers()])
  const pathname = requestHeaders.get('x-pathname') ?? ''
  const redirectPath = passwordChangeRedirectPath({
    passwordChangeRequired: user.passwordChangeRequired,
    pathname
  })

  if (redirectPath) {
    redirect(redirectPath)
  }

  const featureFlags = await loadFeatureFlags()
  return <FeatureFlagsProvider manifest={featureFlags}>{children}</FeatureFlagsProvider>
}
