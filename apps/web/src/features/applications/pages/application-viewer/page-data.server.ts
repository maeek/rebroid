import { unstable_rethrow } from 'next/navigation'
import 'server-only'
import { formatRuntimeCommand } from '@/features/applications/domain/format-runtime-arguments'
import { getPlatformContainerAction } from '@/server/orchestrator/platform/container-actions'
import type { InspectedContainerCommand } from '@/features/applications/manage/app-manage-technical-details'

export const loadInspectedContainerCommand = async (containerId: string): Promise<InspectedContainerCommand | null> => {
  if (!/^[a-f0-9]{64}$/.test(containerId)) return null
  try {
    const { inspect } = await getPlatformContainerAction(containerId)
    const { Id, Path, Args } = inspect
    const args = Args === null ? [] : Args
    if (Id !== containerId || typeof Path !== 'string' || !Path || !Array.isArray(args)) return null
    if (!args.every(arg => typeof arg === 'string')) return null
    return { containerId, command: formatRuntimeCommand([Path, ...args]) }
  } catch (error) {
    unstable_rethrow(error)
    return null
  }
}
