import { IconBrandAndroid } from '@tabler/icons-react'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent } from '@/shared/ui/page/page-layout'
import { StateView } from '@/shared/ui/state-view'

export const AppsListEmptyState = () => {
  return (
    <>
      <PageHeader
        section={{ label: 'Apps' }}
        title='Apps'
        description='Create, monitor, and manage isolated Android applications.'
      />
      <PageContent>
        <StateView
          kind='empty'
          title='No Android apps yet'
          description='Create your first isolated app, upload an APK if needed, and Rebroid will prepare it.'
          icon={<IconBrandAndroid className='size-10' />}
          actions={[{ label: 'Create app', href: '/apps/create' }]}
        />
      </PageContent>
    </>
  )
}
