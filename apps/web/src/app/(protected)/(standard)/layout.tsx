import { cookies } from 'next/headers'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ProtectedShell } from '@/features/shell/components/protected-shell'
import { getCurrentUser } from '@/server/auth/authorization'
import { parseSidebarCollapsed, sidebarCollapsedCookie } from '@/shared/model/settings/sidebar-preference'

export default async function FilesLayout({ children }: { children: React.ReactNode }) {
  const [user, requestCookies] = await Promise.all([getCurrentUser(), cookies()])
  const initialSidebarCollapsed = parseSidebarCollapsed(requestCookies.get(sidebarCollapsedCookie)?.value)

  return (
    <TooltipProvider>
      <ProtectedShell
        user={user}
        initialSidebarCollapsed={initialSidebarCollapsed}
      >
        {children}
      </ProtectedShell>
    </TooltipProvider>
  )
}
