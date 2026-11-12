import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useAiModelCatalogSelection } from './use-ai-model-catalog-selection'
import type { AutomationAiModelCatalogProvider, AutomationAiProviderHealth } from '@/shared/contracts/ai-provider'

const catalog = [
  {
    id: 'local',
    label: 'Local',
    kind: 'ollama',
    models: [
      {
        id: 'qwen',
        label: 'Qwen',
        roles: ['planner', 'vision'],
        defaultFor: ['planner', 'vision'],
        enabled: true,
        settings: {}
      }
    ]
  }
] satisfies AutomationAiModelCatalogProvider[]

describe('useAiModelCatalogSelection', () => {
  it('keeps configured and omitted workflow model settings until explicitly edited', async () => {
    const onSelectionChange = vi.fn()
    const loadCatalog = () => Promise.resolve(catalog)
    const { result } = renderHook(() =>
      useAiModelCatalogSelection({
        role: 'planner',
        loadCatalog,
        modelId: 'model-from-yaml',
        onSelectionChange,
        providerId: 'provider-from-yaml',
        visionModelId: '',
        visionProviderId: '',
        selectionMode: 'explicit'
      })
    )

    await waitFor(() => expect(result.current.isLoadingCatalog).toBe(false))
    expect(onSelectionChange).not.toHaveBeenCalled()
    expect(result.current.selectedProvider).toBeUndefined()
    expect(result.current.selectedModel).toBeUndefined()
    expect(result.current.selectedVisionModel).toBeUndefined()
    act(() => result.current.setProviderId('local'))
    expect(onSelectionChange).toHaveBeenCalledExactlyOnceWith({ providerId: 'local', modelId: 'qwen' })
  })

  it('patches missing planner and vision selection from the catalog', async () => {
    const onSelectionChange = vi.fn()
    renderHook(() =>
      useAiModelCatalogSelection({
        role: 'planner',
        loadCatalog: () => Promise.resolve(catalog),
        modelId: '',
        onSelectionChange,
        providerId: '',
        visionModelId: '',
        visionProviderId: ''
      })
    )

    await waitFor(() =>
      expect(onSelectionChange).toHaveBeenCalledWith({
        providerId: 'local',
        modelId: 'qwen',
        visionProviderId: 'local',
        visionModelId: 'qwen'
      })
    )
  })

  it('checks health for the selected planner model', async () => {
    const health = {
      providerId: 'local',
      modelId: 'qwen',
      status: 'ok',
      message: 'Ready',
      checkedAt: '2026-01-01T00:00:00.000Z'
    } satisfies AutomationAiProviderHealth
    const checkHealth = vi.fn<(providerId: string, modelId: string) => Promise<AutomationAiProviderHealth>>(() =>
      Promise.resolve(health)
    )

    const { result } = renderHook(() =>
      useAiModelCatalogSelection({
        role: 'planner',
        checkHealth,
        loadCatalog: () => Promise.resolve(catalog),
        modelId: 'qwen',
        onSelectionChange: vi.fn(),
        providerId: 'local',
        visionModelId: 'qwen',
        visionProviderId: 'local'
      })
    )

    await waitFor(() => expect(result.current.health).toEqual(health))
    expect(checkHealth).toHaveBeenCalledWith('local', 'qwen', 'planner')
  })

  it('patches planner and matching vision model when provider changes', async () => {
    const onSelectionChange = vi.fn()
    const { result } = renderHook(() =>
      useAiModelCatalogSelection({
        role: 'planner',
        loadCatalog: () => Promise.resolve(catalog),
        modelId: 'qwen',
        onSelectionChange,
        providerId: 'local',
        visionModelId: 'qwen',
        visionProviderId: 'local'
      })
    )

    await waitFor(() => expect(result.current.catalog).toHaveLength(1))

    act(() => result.current.setProviderId('local'))

    expect(onSelectionChange).toHaveBeenCalledWith({
      providerId: 'local',
      modelId: 'qwen',
      visionProviderId: 'local',
      visionModelId: 'qwen'
    })
  })
})
