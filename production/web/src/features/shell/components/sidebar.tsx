'use client'

import { ProtectedNavigation } from './protected-navigation'

export default function Sidebar() {
  return (
    <aside className='h-full w-72 flex flex-col overflow-auto pb-8 fixed left-0 top-16 max-lg:hidden'>
      <ProtectedNavigation variant='sidebar' />
    </aside>
  )
}
