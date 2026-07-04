import { CreateAppForm } from '@/features/applications/create/create-app-form'
import { ProtectedSplitPageContent, ProtectedSplitPageLayout } from '@/shared/ui/page/protected-page-shell'
import { getCreateAppPageData } from './page-data.server'

export const CreateAppPageEntry = async ({ initialImage }: { initialImage?: string } = {}) => {
  const { images, initialSettings, permissions } = await getCreateAppPageData()

  return (
    <ProtectedSplitPageLayout>
      <ProtectedSplitPageContent>
        <CreateAppForm
          images={images}
          initialContainerImage={initialImage}
          initialSettings={initialSettings}
          permissions={permissions}
        />
      </ProtectedSplitPageContent>
    </ProtectedSplitPageLayout>
  )
}
