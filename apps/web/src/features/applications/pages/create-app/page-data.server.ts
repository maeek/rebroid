import { orchestratorApkUploadsClient } from '@/server/orchestrator/applications/apk-client'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'
import { getRequiredServerOrchestratorUiSettings } from '@/server/orchestrator/get-server-ui-settings'
import { listPlatformImagesAction } from '@/server/orchestrator/platform/image-actions'

export const getCreateAppPageData = async (uploadedApkId?: string) => {
  const userPromise = getCurrentUserContext()
  const [initialSettings, user, images, uploadedApks] = await Promise.all([
    getRequiredServerOrchestratorUiSettings(),
    userPromise,
    userPromise.then(currentUser => (currentUser.isPlatformAdmin ? listPlatformImagesAction() : [])),
    userPromise.then(currentUser =>
      uploadedApkId ? orchestratorApkUploadsClient.listUploadedApks(currentUser.ownerUserId) : []
    )
  ])

  return {
    images,
    initialSettings,
    permissions: user.permissions,
    canBuildImages: user.isPlatformAdmin,
    initialUploadedApk: uploadedApks.find(upload => upload.id === uploadedApkId) ?? null
  }
}
