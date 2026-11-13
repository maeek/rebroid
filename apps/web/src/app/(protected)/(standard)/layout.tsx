import { cookies } from 'next/headers'
import { TooltipProvider } from '@/components/ui/tooltip'
import { PinnedViewerProvider } from '@/features/applications/viewer/mini-player/pinned-viewer-provider'
import { ProtectedShell } from '@/features/shell/components/protected-shell'
import { getCurrentUser } from '@/server/auth/authorization'
import { parseSidebarCollapsed, sidebarCollapsedCookie } from '@/shared/model/settings/sidebar-preference'

export default async function FilesLayout({ children }: { children: React.ReactNode }) {
  const [user, requestCookies] = await Promise.all([getCurrentUser(), cookies()])
  const initialSidebarCollapsed = parseSidebarCollapsed(requestCookies.get(sidebarCollapsedCookie)?.value)

  return (
    <TooltipProvider>
      <PinnedViewerProvider>
        <ProtectedShell
          user={{ name: user.name, avatarDataUrl: user.avatarDataUrl, isPlatformAdmin: user.isPlatformAdmin }}
          initialSidebarCollapsed={initialSidebarCollapsed}
        >
          {children}
        </ProtectedShell>
      </PinnedViewerProvider>
    </TooltipProvider>
  )
}
