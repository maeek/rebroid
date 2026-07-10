import { orchestratorApkUploadsClient } from '@/server/orchestrator/applications/apk-client'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'
import { getServerOrchestratorUiSettings } from '@/server/orchestrator/get-server-ui-settings'
import { listPlatformImagesAction } from '@/server/orchestrator/platform/image-actions'

export const getCreateAppPageData = async (uploadedApkId?: string) => {
  const userPromise = getCurrentUserContext()
  const [initialSettings, user, images, uploadedApks] = await Promise.all([
    getServerOrchestratorUiSettings(),
    userPromise,
    listPlatformImagesAction().catch(() => []),
    userPromise.then(currentUser =>
      uploadedApkId ? orchestratorApkUploadsClient.listUploadedApks(currentUser.ownerUserId).catch(() => []) : []
    )
  ])

  return {
    images,
    initialSettings,
    permissions: user.permissions,
    canBuildImages: user.role === 'admin',
    initialUploadedApk: uploadedApks.find(upload => upload.id === uploadedApkId) ?? null
  }
}
