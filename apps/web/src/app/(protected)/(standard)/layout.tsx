import { TooltipProvider } from '@/components/ui/tooltip'
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
          <a
            href='#main-content'
            className='sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-control focus:bg-surface-editor focus:px-4 focus:py-2 focus:text-primary focus:outline-2 focus:outline-ring'
          >
            Skip to main content
          </a>
          <TopBarProtected initialUser={user} />
          <div className='h-[calc(100%-4rem)] w-full'>
            <Sidebar initialUser={user} />
            <main
              id='main-content'
              tabIndex={-1}
              className='min-h-[calc(100dvh-4rem)] w-full min-w-0 scroll-mt-16 pl-72 max-lg:pl-0 max-sm:w-full'
            >
              <div className='mx-auto flex w-full max-w-[120rem] flex-col'>{children}</div>
            </main>
          </div>
        </div>
      </PageBackdropProvider>
    </TooltipProvider>
  )
}
