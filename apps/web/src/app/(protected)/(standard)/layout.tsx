import { TooltipProvider } from '@/components/ui/tooltip'
import { ProtectedShell } from '@/features/shell/components/protected-shell'
import { getCurrentUser } from '@/server/auth/authorization'
import { PageBackdropProvider } from '@/shared/ui/page/page-backdrop'

export default async function FilesLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()

  return (
    <TooltipProvider>
      <PageBackdropProvider>
        <ProtectedShell user={user}>{children}</ProtectedShell>
      </PageBackdropProvider>
    </TooltipProvider>
  )
}
