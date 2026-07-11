import { CreateAppForm } from '@/features/applications/create/create-app-form'
import { PageContent, StandardPageSplit } from '@/shared/ui/page/page-layout'
import { getCreateAppPageData } from './page-data.server'

export const CreateAppPageEntry = async ({
  initialImage,
  uploadedApkId
}: { initialImage?: string; uploadedApkId?: string } = {}) => {
  const { images, initialSettings, permissions, canBuildImages, initialUploadedApk } =
    await getCreateAppPageData(uploadedApkId)

  return (
    <StandardPageSplit>
      <PageContent>
        <CreateAppForm
          images={images}
          initialContainerImage={initialImage}
          initialSettings={initialSettings}
          permissions={permissions}
          canBuildImages={canBuildImages}
          initialUploadedApk={initialUploadedApk}
        />
      </PageContent>
    </StandardPageSplit>
  )
}
