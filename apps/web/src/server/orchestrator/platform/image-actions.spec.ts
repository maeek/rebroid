import { beforeEach, expect, it, vi } from 'vitest'
import { requireAdmin } from '@/server/auth/authorization'
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
    startImageBuild: vi.fn()
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
  expect(requireFeature).toHaveBeenCalledWith('feature.image-builder')
  expect(orchestratorPlatformClient[method]).not.toHaveBeenCalled()
})
