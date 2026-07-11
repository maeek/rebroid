import { TooltipProvider } from '@/components/ui/tooltip'
import { SquircleSVG } from '@/features/applications/components/squircle-svg'
import Sidebar from '@/features/shell/components/sidebar'
import { TopBarProtected } from '@/features/shell/components/top-bar/top-bar'
import { getCurrentUser } from '@/server/auth/authorization'
import { PageBackdropProvider } from '@/shared/ui/page/page-backdrop'

export default async function FilesLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()

  return (
    <TooltipProvider>
      <PageBackdropProvider>
        <div className='main-layout relative z-10 pt-16'>
          <TopBarProtected initialUser={user} />
          <div className='h-[calc(100%-4rem)] w-full'>
            <Sidebar initialUser={user} />
            <main className='min-h-[calc(100dvh-4rem)] w-full pl-72 max-lg:pl-0 max-sm:w-full'>
              <div className='mx-auto flex w-full max-w-[120rem] flex-col'>{children}</div>
            </main>
          </div>
        </div>
      </PageBackdropProvider>
      <SquircleSVG />
    </TooltipProvider>
  )
}
