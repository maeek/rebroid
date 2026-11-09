import { CreateAppForm } from '@/features/applications/create/create-app-form'
import { OrchestratorPageBoundary } from '@/server/orchestrator/orchestrator-page-boundary'
import { EditorPage } from '@/shared/ui/page/editor-page'
import { PlatformRouteUnavailable } from '@/shared/ui/page/platform-route-unavailable'
import { getCreateAppPageData } from './page-data.server'

export const CreateAppPageEntry = ({
  initialImage,
  uploadedApkId
}: { initialImage?: string; uploadedApkId?: string } = {}) => {
  return (
    <OrchestratorPageBoundary
      load={() => getCreateAppPageData(uploadedApkId)}
      fallback={requestId => (
        <PlatformRouteUnavailable
          requestId={requestId}
          title='Create app'
          description='Configure a new Android application.'
          section={{ label: 'Apps', href: '/apps' }}
        />
      )}
    >
      {({ images, initialSettings, permissions, canBuildImages, initialUploadedApk }) => (
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
      )}
    </OrchestratorPageBoundary>
  )
}
