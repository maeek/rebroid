import type { ReactNode } from 'react'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'
import { ContainerResourceNavigation } from './container-resource-navigation'

export const ContainerDetailLayout = ({
  children,
  header,
  id,
  view
}: {
  children: ReactNode
  header: ReactNode
  id?: string
  view: 'overview' | 'logs'
}) => (
  <StandardPage className={view === 'logs' ? 'gap-2 lg:h-(--console-content-height) lg:min-h-min' : 'gap-2'}>
    {header}
    <PageContent className={view === 'logs' ? 'lg:flex-1 lg:pb-6' : undefined}>
      <ContainerResourceNavigation
        id={id}
        view={view}
      />
      {children}
    </PageContent>
  </StandardPage>
)
