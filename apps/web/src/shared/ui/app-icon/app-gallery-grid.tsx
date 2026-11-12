import type { ReactNode } from 'react'

export const AppGalleryGrid = ({ children, label = 'Apps' }: { children: ReactNode; label?: string }) => (
  <ul
    aria-label={label}
    className='grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5'
  >
    {children}
  </ul>
)
