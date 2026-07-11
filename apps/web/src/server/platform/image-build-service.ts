import 'server-only'
import { orchestratorPlatformClient } from '@/server/orchestrator/platform/client'
import { runAuditedPlatformAction } from '@/server/orchestrator/platform/platform-audit'
import { requireAdminUser } from '@/server/orchestrator/shared'
import type { StartGappsBuildInput } from '@/shared/contracts/platform-image-build'

export const getImageBuildJob = async (id: string) => {
  await requireAdminUser()
  return orchestratorPlatformClient.getImageBuildJob(id)
}

export const cancelImageBuild = async (id: string) => {
  return runAuditedPlatformAction({
    action: 'docker.image_build.cancel',
    operation: () => orchestratorPlatformClient.cancelImageBuild(id),
    resourceType: 'docker_image_build',
    resourceId: id
  })
}

export const startGappsBuild = async (input: StartGappsBuildInput) => {
  return runAuditedPlatformAction({
    action: 'docker.image_build.gapps_patch.start',
    details: { ...input },
    operation: () => orchestratorPlatformClient.startGappsBuild(input),
    resourceType: 'docker_image_build',
    resourceId: input.targetImage ?? `android-${input.androidVersion}`
  })
}

export const clearGappsCache = async (androidVersion: string) => {
  return runAuditedPlatformAction({
    action: 'docker.image_build.gapps_cache.clear',
    details: { androidVersion },
    operation: () => orchestratorPlatformClient.clearGappsCache(androidVersion),
    resourceType: 'docker_image_build_cache',
    resourceId: androidVersion
  })
}
