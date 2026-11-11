import { expect, it, vi } from 'vitest'
import { getPlatformContainerAction } from '@/server/orchestrator/platform/container-actions'
import { loadInspectedContainerCommand } from './page-data.server'
import type { PlatformContainerDetails } from '@/shared/contracts/platform'

vi.mock('@/server/orchestrator/platform/container-actions', () => ({ getPlatformContainerAction: vi.fn() }))

const id = 'a'.repeat(64)

const details = (inspect: Record<string, unknown>): PlatformContainerDetails => ({
  inspect,
  container: { command: '/init ...' } as PlatformContainerDetails['container'],
  relatedImage: null,
  relatedNetworks: []
})

it('uses the exact Docker executable and arguments rather than the container list command', async () => {
  vi.mocked(getPlatformContainerAction).mockResolvedValue(
    details({
      Id: id,
      Path: '/init',
      Args: ['androidboot.redroid_gpu_mode=host', 'androidboot.redroid_gpu_node=/dev/dri/renderD128', 'name=My device']
    })
  )

  const result = await loadInspectedContainerCommand(id)
  expect(result?.containerId).toBe(id)
  expect(result?.command).toContain('androidboot.redroid_gpu_mode=host')
  expect(result?.command).toContain('androidboot.redroid_gpu_node=/dev/dri/renderD128')
  expect(result?.command).toContain("'name=My device'")
  expect(result?.command).toMatch(/^\/init /)
})

it('returns no command if the Docker response belongs to a different container', async () => {
  vi.mocked(getPlatformContainerAction).mockResolvedValue(details({ Id: 'b'.repeat(64), Path: '/init', Args: [] }))
  await expect(loadInspectedContainerCommand(id)).resolves.toBeNull()
})
