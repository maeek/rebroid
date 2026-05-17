import { redirect, RedirectType } from 'next/navigation'
import { TooltipProvider } from '@/components/ui/tooltip'
import { SquircleSVG } from '@/features/applications/components/squircle-svg'
import Sidebar from '@/features/shell/components/sidebar'
import { TopBarProtected } from '@/features/shell/components/top-bar/top-bar'
import { getServerAuthSession } from '@/server/auth/auth'

export default async function FilesLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerAuthSession()

  if (!session) {
    return redirect('/login', RedirectType.replace)
  }

  return (
    <TooltipProvider>
      <div className='main-layout'>
        <TopBarProtected />
        <div className='h-[calc(100%-4rem)] w-full'>
          <Sidebar />
          {children}
        </div>
      </div>
      <SquircleSVG />
    </TooltipProvider>
  )
}
