'use client'

import { ProtectedNavigation } from './protected-navigation'
import type { ShellUser } from './shell-user'

export default function Sidebar({ initialUser }: { initialUser: ShellUser }) {
  return (
    <aside className='fixed left-0 top-16 z-40 flex h-full w-72 flex-col overflow-auto pb-8 max-lg:hidden'>
      <ProtectedNavigation
        variant='sidebar'
        initialUser={initialUser}
      />
    </aside>
  )
}
