import { CreateAppForm } from '@/features/applications/create/create-app-form'
import { EditorPage } from '@/shared/ui/page/editor-page'
import { getCreateAppPageData } from './page-data.server'

export const CreateAppPageEntry = async ({
  initialImage,
  uploadedApkId
}: { initialImage?: string; uploadedApkId?: string } = {}) => {
  const { images, initialSettings, permissions, canBuildImages, initialUploadedApk } =
    await getCreateAppPageData(uploadedApkId)

  return (
    <EditorPage
      width='full'
      className='gap-2'
    >
      <CreateAppForm
        images={images}
        initialContainerImage={initialImage}
        initialSettings={initialSettings}
        permissions={permissions}
        canBuildImages={canBuildImages}
        initialUploadedApk={initialUploadedApk}
      />
    </EditorPage>
  )
}
