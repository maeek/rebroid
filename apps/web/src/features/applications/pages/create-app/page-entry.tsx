import { CreateAppForm } from '@/features/applications/create/create-app-form'
import { ProtectedSplitPageContent, ProtectedSplitPageLayout } from '@/shared/ui/page/protected-page-shell'
import { getCreateAppPageData } from './page-data.server'

export const CreateAppPageEntry = async ({
  initialImage,
  uploadedApkId
}: { initialImage?: string; uploadedApkId?: string } = {}) => {
  const { images, initialSettings, permissions, canBuildImages, initialUploadedApk } =
    await getCreateAppPageData(uploadedApkId)

  return (
    <ProtectedSplitPageLayout>
      <ProtectedSplitPageContent>
        <CreateAppForm
          images={images}
          initialContainerImage={initialImage}
          initialSettings={initialSettings}
          permissions={permissions}
          canBuildImages={canBuildImages}
          initialUploadedApk={initialUploadedApk}
        />
      </ProtectedSplitPageContent>
    </ProtectedSplitPageLayout>
  )
}
