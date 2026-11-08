import type { ReactNode } from 'react'
import { Section } from '@/components/ui/section'

export const AppsGridLayout = ({ children, title, count }: { children: ReactNode; title: string; count?: number }) => (
  <Section
    surface='plain'
    title={count === undefined ? title : `${title} (${count})`}
    headingSpacing='compact'
  >
    <div className='grid grid-cols-[repeat(auto-fill,minmax(min(100%,10rem),1fr))] gap-3'>{children}</div>
  </Section>
)
