import type { ReactNode } from 'react'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'
import { ContainerResourceNavigation } from './container-resource-navigation'
import type { ContainerResourceView } from '@/shared/model/container-resource-href'

export const ContainerDetailLayout = ({
  children,
  header,
  id,
  view
}: {
  children: ReactNode
  header: ReactNode
  id?: string
  view: ContainerResourceView
}) => (
  <StandardPage className={view !== 'overview' ? 'gap-2 lg:h-(--console-content-height) lg:min-h-min' : 'gap-2'}>
    {header}
    <PageContent className={view !== 'overview' ? 'lg:flex-1 lg:pb-6' : undefined}>
      <ContainerResourceNavigation
        id={id}
        view={view}
      />
      {children}
    </PageContent>
  </StandardPage>
)
