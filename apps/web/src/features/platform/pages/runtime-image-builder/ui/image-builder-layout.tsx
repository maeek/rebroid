import type { ReactNode } from 'react'
import { IconBrandGooglePlay, IconHammer } from '@tabler/icons-react'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'
import { ResourceNavigation } from '@/shared/ui/resource-navigation'

export const ImageBuilderLayout = ({
  mode,
  actions,
  children
}: {
  mode: 'gapps' | 'custom'
  actions: ReactNode
  children: ReactNode
}) => (
  <StandardPage className='min-w-0'>
    <PageHeader
      section={{ label: 'Docker' }}
      trail={[{ label: 'Images', href: '/runtime/images' }]}
      title={mode === 'gapps' ? 'Build Google Play image' : 'Build custom image'}
      description={
        mode === 'gapps'
          ? 'Add Google Play services to an official ReDroid image.'
          : 'Configure an image recipe, provide its files, and build with a Dockerfile.'
      }
      actions={actions}
    />
    <PageContent>
      <ResourceNavigation
        label='Image builder'
        items={[
          {
            id: 'gapps',
            label: 'Google Play builder',
            icon: <IconBrandGooglePlay className='size-3.5' />,
            href: '/runtime/images/build',
            current: mode === 'gapps'
          },
          {
            id: 'custom',
            label: 'Custom builder',
            icon: <IconHammer className='size-3.5' />,
            href: '/runtime/images/build/custom',
            current: mode === 'custom'
          }
        ]}
      />
      {children}
    </PageContent>
  </StandardPage>
)

export const ImageBuilderColumns = ({
  configuration,
  workspace,
  custom = false
}: {
  configuration: ReactNode
  workspace: ReactNode
  custom?: boolean
}) => (
  <div
    className={`@container/builder grid min-w-0 items-start gap-6 ${custom ? 'xl:grid-cols-[minmax(20rem,24rem)_minmax(0,1fr)]' : 'xl:grid-cols-2'}`}
  >
    <div className='grid min-w-0 gap-6 [&>*]:min-w-0'>{configuration}</div>
    <div className='grid min-w-0 gap-6 [&>*]:min-w-0'>{workspace}</div>
  </div>
)
