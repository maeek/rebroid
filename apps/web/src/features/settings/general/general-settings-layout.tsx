import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { EditorPage } from '@/shared/ui/page/editor-page'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent } from '@/shared/ui/page/page-layout'

const personalSections = [
  { id: 'appearance', label: 'Appearance' },
  { id: 'profile', label: 'Profile' },
  { id: 'security', label: 'Security' }
]

export const GeneralSettingsLayout = ({ children, showDefaults }: { children: ReactNode; showDefaults: boolean }) => {
  const sections = showDefaults
    ? [...personalSections, { id: 'console-defaults', label: 'Console defaults' }]
    : personalSections

  return (
    <EditorPage className='gap-2'>
      <PageHeader
        section={{ label: 'Preferences' }}
        title='General'
      />
      <PageContent>
        <nav
          aria-label='Preference sections'
          className='flex flex-wrap gap-1'
        >
          {sections.map(({ id, label }) => (
            <Button
              key={id}
              asChild
              variant='ghost'
              size='sm'
            >
              <a href={'#' + id}>{label}</a>
            </Button>
          ))}
        </nav>
        {children}
      </PageContent>
    </EditorPage>
  )
}
