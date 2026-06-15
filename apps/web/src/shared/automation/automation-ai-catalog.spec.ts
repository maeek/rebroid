import { describe, expect, it } from '@jest/globals'
import {
  aiModelDisplayName,
  aiModelSubtitle,
  aiProviderKindLabel,
  catalogByRole,
  nextCatalogProviderAndModel,
  selectCatalogModel,
  selectCatalogProvider,
  selectCatalogProviderAndModel
} from './automation-ai-catalog'
import type { AutomationAiModelCatalogProvider } from '@/server/orchestrator/settings/types'

const catalog = [
  {
    id: 'planner-only',
    label: 'Planner Only',
    kind: 'openai',
    models: [
      {
        id: 'p-default',
        label: 'Planner Default',
        roles: ['planner'],
        defaultFor: ['planner'],
        enabled: true,
        settings: {}
      },
      {
        id: 'p-extra',
        label: 'Planner Extra',
        roles: ['planner'],
        defaultFor: [],
        enabled: true,
        settings: {}
      }
    ]
  },
  {
    id: 'vision-only',
    label: 'Vision Only',
    kind: 'openai-compatible',
    models: [
      {
        id: 'v-default',
        label: 'Vision Default',
        roles: ['vision'],
        defaultFor: ['vision'],
        enabled: true,
        settings: {}
      }
    ]
  }
] as unknown as AutomationAiModelCatalogProvider[]

describe('automation-ai-catalog', () => {
  it('filters catalog by model role', () => {
    const plannerCatalog = catalogByRole(catalog, 'planner')
    const visionCatalog = catalogByRole(catalog, 'vision')

    expect(plannerCatalog).toHaveLength(1)
    expect(plannerCatalog[0]?.id).toBe('planner-only')
    expect(visionCatalog).toHaveLength(1)
    expect(visionCatalog[0]?.id).toBe('vision-only')
  })

  it('falls back to first provider and default model when ids are missing', () => {
    const provider = selectCatalogProvider(catalogByRole(catalog, 'planner'), '')
    const model = selectCatalogModel(provider, '')

    expect(provider?.id).toBe('planner-only')
    expect(model?.id).toBe('p-default')
  })

  it('falls back to provider default model if model id is unknown', () => {
    const provider = selectCatalogProvider(catalogByRole(catalog, 'planner'), 'planner-only')
    const model = selectCatalogModel(provider, 'missing')

    expect(provider?.id).toBe('planner-only')
    expect(model?.id).toBe('p-default')
  })

  it('selects provider and model together', () => {
    const selected = selectCatalogProviderAndModel(catalog, 'planner-only', 'p-extra')

    expect(selected.provider?.id).toBe('planner-only')
    expect(selected.model?.id).toBe('p-extra')
  })

  it('selects the next provider default model when provider changes', () => {
    const selected = nextCatalogProviderAndModel(catalog, 'vision-only')

    expect(selected.provider?.id).toBe('vision-only')
    expect(selected.model?.id).toBe('v-default')
  })

  it('formats provider and model labels for picker surfaces', () => {
    const provider = catalog[1]
    const model = provider?.models[0]

    expect(aiProviderKindLabel('openai-compatible')).toBe('OpenAI-compatible')
    expect(aiModelDisplayName(model)).toBe('Vision Default')
    expect(aiModelSubtitle(provider, model)).toBe('OpenAI-compatible · Vision Only')
  })
})
