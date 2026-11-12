import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { EditorPage } from '@/shared/ui/page/editor-page'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent } from '@/shared/ui/page/page-layout'

const personalSections = [
  { id: 'appearance', label: 'Appearance' },
  { id: 'profile', label: 'Profile' }
]

export const GeneralSettingsLayout = ({ children }: { children: ReactNode }) => {
  return (
    <EditorPage className='gap-2'>
      <PageHeader
        section={{ label: 'Preferences' }}
        title='General'
        description='Personalize your appearance, viewer layout, and profile photo.'
      />
      <PageContent>
        <nav
          aria-label='Preference sections'
          className='flex flex-wrap gap-1'
        >
          {personalSections.map(({ id, label }) => (
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
