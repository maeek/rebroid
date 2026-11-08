import { IconBrandAndroid } from '@tabler/icons-react'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent } from '@/shared/ui/page/page-layout'
import { StateView } from '@/shared/ui/state-view'

export const AppsListEmptyState = ({ canCreate }: { canCreate: boolean }) => {
  return (
    <>
      <PageHeader
        title='Apps'
        description='Create, monitor, and manage isolated Android applications.'
      />
      <PageContent>
        <StateView
          kind='empty'
          title='No Android apps yet'
          description={
            canCreate
              ? 'Create your first isolated app, upload an APK if needed, and Rebroid will prepare it.'
              : 'No apps are available for your account.'
          }
          icon={<IconBrandAndroid className='size-10' />}
          actions={canCreate ? [{ label: 'Create app', href: '/apps/create' }] : undefined}
        />
      </PageContent>
    </>
  )
}
