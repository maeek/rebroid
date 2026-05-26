import { TooltipProvider } from '@/components/ui/tooltip'
import { SquircleSVG } from '@/features/applications/components/squircle-svg'
import Sidebar from '@/features/shell/components/sidebar'
import { TopBarProtected } from '@/features/shell/components/top-bar/top-bar'
import { getCurrentUser } from '@/server/auth/authorization'
import { PageBackdropProvider } from '../../../features/shell/components/page-backdrop'

export default async function FilesLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()

  return (
    <TooltipProvider>
      <PageBackdropProvider
        defaultBackdrop={{
          imageSrc: user.avatarDataUrl,
          opacity: 0.028
        }}
      >
        <div className='main-layout relative z-10'>
          <TopBarProtected />
          <div className='h-[calc(100%-4rem)] w-full'>
            <Sidebar />
            {children}
          </div>
        </div>
      </PageBackdropProvider>
      <SquircleSVG />
    </TooltipProvider>
  )
}
