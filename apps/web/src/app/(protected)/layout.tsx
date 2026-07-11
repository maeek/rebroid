import type { ReactNode } from 'react'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getAuthenticatedUser } from '@/server/auth/authorization'
import { passwordChangeRedirectPath } from '@/server/auth/password-change-routing'

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const [user, requestHeaders] = await Promise.all([getAuthenticatedUser(), headers()])
  const pathname = requestHeaders.get('x-pathname') ?? ''
  const redirectPath = passwordChangeRedirectPath({
    passwordChangeRequired: user.passwordChangeRequired,
    pathname
  })

  if (redirectPath) {
    redirect(redirectPath)
  }

  return children
}
