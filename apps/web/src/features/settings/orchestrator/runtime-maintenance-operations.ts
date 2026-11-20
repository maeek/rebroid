import {
  pruneAllDockerResourcesAction,
  pruneContainersAction,
  pruneImagesAction,
  pruneNetworksAction,
  pruneVolumesAction
} from '@/server/orchestrator/docker-maintenance/actions'
import { unwrapActionResult } from '@/shared/actions/action-result'
import type { DockerPruneResponse } from '@/shared/contracts/docker-maintenance'

export type RuntimeMaintenanceOperation = {
  key: string
  title: string
  description: string
  actionLabel: string
  confirmation: string
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
    key: 'images',
    title: 'Dangling images',
    description: 'Remove untagged Docker images that are no longer in use.',
    actionLabel: 'Remove dangling images',
    confirmation: 'Remove untagged images that are no longer in use from the Docker host.',
    run: async () => summarizePruneResult(unwrapActionResult(await pruneImagesAction(true)))
  },
  {
    key: 'containers',
    title: 'Stopped containers',
    description: 'Remove stopped Docker containers from the host.',
    actionLabel: 'Remove stopped containers',
    confirmation:
      'Remove all stopped containers on the Docker host, including those outside Rebroid. This deletes their writable data.',
    run: async () => summarizePruneResult(unwrapActionResult(await pruneContainersAction()))
  },
  {
    key: 'networks',
    title: 'Unused networks',
    description: 'Remove Docker networks with no attached containers.',
    actionLabel: 'Remove unused networks',
    confirmation: 'Remove networks with no attached containers from the Docker host.',
    run: async () => summarizePruneResult(unwrapActionResult(await pruneNetworksAction()))
  },
  {
    key: 'volumes',
    title: 'Unused volumes',
    description: 'Remove Docker volumes not referenced by any container.',
    actionLabel: 'Remove unused volumes',
    confirmation: 'Permanently delete Docker volumes with no container references. They can still hold saved app data.',
    run: async () => summarizePruneResult(unwrapActionResult(await pruneVolumesAction()))
  },
  {
    key: 'all',
    title: 'Full Docker cleanup',
    description: 'Remove stopped containers, dangling images, unused networks, and unused volumes.',
    actionLabel: 'Run full Docker cleanup',
    confirmation:
      'Remove stopped containers, dangling images, unused networks, and unused volumes across the Docker host, including outside Rebroid. Data in removed containers and volumes is lost. APK uploads are kept.',
    run: async () => {
      unwrapActionResult(await pruneAllDockerResourcesAction())
      return 'Stopped containers, dangling images, unused networks, and unused volumes were cleaned up.'
    }
  }
]
