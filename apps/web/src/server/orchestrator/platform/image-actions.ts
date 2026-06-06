'use server'

import { requireAdminUser } from '../shared'
import { orchestratorPlatformClient } from './client'
import { runAuditedPlatformAction } from './platform-audit'
import { platformImagesGridPage } from './platform-grid-utils'
import type { PlatformImagesGridPage, PlatformImagesGridQuery } from './types'

export const listPlatformImagesAction = async () => {
  await requireAdminUser()
  return orchestratorPlatformClient.listPlatformImages()
}

export const listPlatformImagesGridAction = async (
  query: PlatformImagesGridQuery = {}
): Promise<PlatformImagesGridPage> => {
  await requireAdminUser()
  return platformImagesGridPage(await orchestratorPlatformClient.listPlatformImages(), query)
}

export const getPlatformImageAction = async (id: string) => {
  await requireAdminUser()
  return orchestratorPlatformClient.getPlatformImage(id)
}

export const removePlatformImageAction = async (id: string, force = false) =>
  runAuditedPlatformAction({
    action: 'docker.image.remove',
    details: { force },
    operation: () => orchestratorPlatformClient.removePlatformImage(id, force),
    resourceType: 'docker_image',
    resourceId: id
  })
