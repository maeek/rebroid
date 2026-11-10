'use client'

import { cn } from '@/lib/utils'
import { ProtectedNavigation } from './protected-navigation'
import type { ShellUser } from './shell-user'

export default function Sidebar({ initialUser, collapsed = false }: { initialUser: ShellUser; collapsed?: boolean }) {
  return (
    <aside
      id='desktop-navigation'
      aria-label='Primary navigation'
      className={cn(
        'scrollbar-thin fixed bottom-0 left-0 top-16 z-40 w-72 overflow-y-auto overscroll-contain pb-4',
        collapsed ? 'hidden' : 'hidden lg:block'
      )}
    >
      <ProtectedNavigation
        variant='sidebar'
        initialUser={initialUser}
      />
    </aside>
  )
}
