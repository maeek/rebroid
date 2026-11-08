'use client'

import { ProtectedNavigation } from './protected-navigation'
import type { ShellUser } from './shell-user'

export default function Sidebar({ initialUser }: { initialUser: ShellUser }) {
  return (
    <aside className='fixed bottom-0 left-0 top-16 z-40 flex w-72 flex-col overflow-y-auto overscroll-contain pb-4 max-lg:hidden'>
      <ProtectedNavigation
        variant='sidebar'
        initialUser={initialUser}
      />
    </aside>
  )
}
