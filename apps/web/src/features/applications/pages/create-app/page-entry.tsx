import { CreateAppForm } from '@/features/applications/create/create-app-form'
import { ProtectedSplitPageContent, ProtectedSplitPageLayout } from '@/shared/ui/page/protected-page-shell'
import { getCreateAppPageData } from './page-data.server'

export const CreateAppPageEntry = async () => {
  const { initialSettings, permissions } = await getCreateAppPageData()

  return (
    <ProtectedSplitPageLayout>
      <ProtectedSplitPageContent>
        <CreateAppForm
          initialSettings={initialSettings}
          permissions={permissions}
        />
      </ProtectedSplitPageContent>
    </ProtectedSplitPageLayout>
  )
}
