import {
  pruneAllDockerResourcesAction,
  pruneContainersAction,
  pruneImagesAction,
  pruneNetworksAction,
  pruneVolumesAction
} from '@/server/orchestrator/docker-maintenance/actions'
import { cleanupUploadedApksAction } from '@/server/orchestrator/settings/actions'
import { unwrapActionResult } from '@/shared/actions/action-result'
import type { DockerPruneResponse } from '@/shared/contracts/docker-maintenance'

export type RuntimeMaintenanceOperation = {
  key: string
  title: string
  description: string
  consequence: string
  run: () => Promise<string>
}

const summarizePruneResult = (result: DockerPruneResponse) => {
  const count =
    result.ContainersDeleted?.length ??
    result.ImagesDeleted?.length ??
    result.NetworksDeleted?.length ??
    result.VolumesDeleted?.length ??
    0
  const bytes = result.SpaceReclaimed ?? 0
  if (bytes <= 0) return `Removed ${count} items.`
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `Removed ${count} items and reclaimed ${(bytes / 1024 ** index).toFixed(2)} ${units[index]}.`
}

export const runtimeMaintenanceOperations: RuntimeMaintenanceOperation[] = [
  {
    key: 'apks',
    title: 'Unused APK uploads',
    description: 'Remove uploaded files and records that no app references.',
    consequence: 'Unreferenced APK uploads will be permanently deleted.',
    run: async () => {
      const result = await cleanupUploadedApksAction()
      return `Removed ${result.deletedRecords} upload records and ${result.removedFiles} files.`
    }
  },
  {
    key: 'images',
    title: 'Dangling images',
    description: 'Remove untagged Docker images that are no longer in use.',
    consequence: 'Dangling images will be removed from the Docker host.',
    run: async () => summarizePruneResult(unwrapActionResult(await pruneImagesAction(true)))
  },
  {
    key: 'containers',
    title: 'Stopped containers',
    description: 'Remove stopped Docker containers from the host.',
    consequence:
      'All stopped containers on the Docker host are eligible, including containers outside managed apps. Their writable data will be deleted.',
    run: async () => summarizePruneResult(unwrapActionResult(await pruneContainersAction()))
  },
  {
    key: 'networks',
    title: 'Unused networks',
    description: 'Remove Docker networks with no attached containers.',
    consequence: 'Unused networks will be removed from the Docker host.',
    run: async () => summarizePruneResult(unwrapActionResult(await pruneNetworksAction()))
  },
  {
    key: 'volumes',
    title: 'Unused volumes',
    description: 'Remove Docker volumes not referenced by any container.',
    consequence: 'Unused volumes can contain persistent app data. Removed data cannot be recovered.',
    run: async () => summarizePruneResult(unwrapActionResult(await pruneVolumesAction()))
  },
  {
    key: 'all',
    title: 'Full Docker cleanup',
    description: 'Clean up stopped containers, dangling images, unused networks, and volumes.',
    consequence:
      'This applies to the Docker host, including resources outside managed apps. Stopped containers and unused volumes can contain data that cannot be recovered. APK uploads are not included.',
    run: async () => {
      unwrapActionResult(await pruneAllDockerResourcesAction())
      return 'Stopped containers, dangling images, unused networks, and unused volumes were cleaned up.'
    }
  }
]
