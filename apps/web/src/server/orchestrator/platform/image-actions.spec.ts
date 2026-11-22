import { beforeEach, expect, it, vi } from 'vitest'
import { requireAdmin } from '@/server/auth/authorization'
import { PublicActionError } from '@/server/errors/public-action-error'
import { clearGappsCache, startGappsBuild } from '@/server/platform/image-build-service'
import { requireFeature } from '../features'
import { orchestratorPlatformClient } from './client'
import { createImageBuildRecipeAction, removeImageBuildContextFileAction, startImageBuildAction } from './image-actions'
import type { ContainerImageRecipeInput } from '@/shared/contracts/platform'

vi.mock('../features', () => ({ requireFeature: vi.fn() }))
vi.mock('@/server/auth/authorization', () => ({ requireAdmin: vi.fn() }))
vi.mock('../shared', () => ({ revalidateOrchestratorPages: vi.fn() }))
vi.mock('./client', () => ({
  orchestratorPlatformClient: {
    createImageBuildRecipe: vi.fn(),
    removeImageBuildContextFile: vi.fn(),
    startImageBuild: vi.fn(),
    startGappsBuild: vi.fn(),
    clearGappsCache: vi.fn()
  }
}))

const recipe: ContainerImageRecipeInput = {
  name: 'Example',
  targetImage: 'example:test',
  baseImage: 'example:base',
  runtimeKind: 'generic',
  gmsMode: 'none',
  signatureSpoofing: 'not_applicable',
  dockerfile: 'FROM example:base'
}
beforeEach(() => vi.resetAllMocks())

it.each([
  ['startGappsBuild', () => startGappsBuild({ androidVersion: '15', targetImage: 'example:play' })],
  ['clearGappsCache', () => clearGappsCache('15')]
] as const)('requires the API administrator before checking the GApps feature for %s', async (method, invoke) => {
  vi.mocked(requireAdmin).mockRejectedValueOnce(new PublicActionError('Forbidden', { code: 'forbidden', status: 403 }))
  await expect(invoke()).rejects.toMatchObject({ status: 403 })
  expect(requireAdmin).toHaveBeenCalledWith('api')
  expect(requireFeature).not.toHaveBeenCalled()
  vi.mocked(requireFeature).mockRejectedValueOnce(
    new PublicActionError('Unavailable', { code: 'not_found', status: 404 })
  )
  await expect(invoke()).rejects.toMatchObject({ status: 404 })
  expect(requireFeature).toHaveBeenCalledWith('feature.image-builder', 'api')
  expect(orchestratorPlatformClient[method]).not.toHaveBeenCalled()
})

it.each([
  ['createImageBuildRecipe', () => createImageBuildRecipeAction(recipe)],
  ['removeImageBuildContextFile', () => removeImageBuildContextFileAction('context')],
  ['startImageBuild', () => startImageBuildAction(recipe)]
] as const)('checks administrator access before reading features for %s', async (method, invoke) => {
  vi.mocked(requireAdmin).mockRejectedValue(new Error('Forbidden'))
  expect((await invoke()).ok).toBe(false)
  expect(requireFeature).not.toHaveBeenCalled()
  expect(orchestratorPlatformClient[method]).not.toHaveBeenCalled()

  vi.mocked(requireAdmin).mockReset()
  vi.mocked(requireFeature).mockRejectedValue(new Error('Feature unavailable'))
  expect((await invoke()).ok).toBe(false)
  expect(requireFeature).toHaveBeenCalledWith('feature.image-builder', undefined)
  expect(orchestratorPlatformClient[method]).not.toHaveBeenCalled()
})
