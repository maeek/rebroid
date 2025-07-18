import { redirect, RedirectType } from 'next/navigation'
import { getServerAuthSession } from '@/server/auth/auth'
import Sidebar from '../_components/sidebar'
import { TopBarProtected } from '../_components/top-bar/top-bar'
import { TooltipProvider } from '@/components/ui/tooltip'
import { SquircleSVG } from './apps/_components/squircle-svg'

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
