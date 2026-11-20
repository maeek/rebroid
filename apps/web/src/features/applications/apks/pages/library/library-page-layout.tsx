import type { ReactNode } from 'react'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'

export const ApkLibraryPageLayout = ({ children }: { children: ReactNode }) => (
  <StandardPage
    gridToolbar
    className='gap-2'
  >
    <PageHeader
      section={{ label: 'Administration' }}
      title='APK library'
    />
    <PageContent>{children}</PageContent>
  </StandardPage>
)
