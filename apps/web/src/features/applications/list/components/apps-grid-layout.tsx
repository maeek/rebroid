import type { ReactNode } from 'react'

export const AppsGridLayout = ({ children }: { children: ReactNode }) => (
  <ul
    aria-label='Apps'
    className='grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5'
  >
    {children}
  </ul>
)
