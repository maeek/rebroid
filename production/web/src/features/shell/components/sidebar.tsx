'use client'

import { ProtectedNavigation } from './protected-navigation'

export default function Sidebar() {
  return (
    <aside className='fixed left-0 top-16 z-40 flex h-full w-72 flex-col overflow-auto pb-8 max-lg:hidden'>
      <ProtectedNavigation variant='sidebar' />
    </aside>
  )
}
