import type { ReactNode } from 'react'
import { EditorPage } from '@/shared/ui/page/editor-page'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent } from '@/shared/ui/page/page-layout'

export const GeneralSettingsLayout = ({ children }: { children: ReactNode }) => {
  return (
    <EditorPage className='gap-2'>
      <PageHeader
        section={{ label: 'Preferences' }}
        title='General'
        description='Personalize your appearance, viewer layout, and profile photo.'
      />
      <PageContent>{children}</PageContent>
    </EditorPage>
  )
}
