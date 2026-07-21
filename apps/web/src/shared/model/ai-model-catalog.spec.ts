import { describe, expect, it } from 'vitest'
import {
  aiModelDisplayName,
  aiModelSubtitle,
  aiProviderKindLabel,
  catalogByRole,
  nextCatalogProviderAndModel,
  selectCatalogModel,
  selectCatalogProvider,
  selectCatalogProviderAndModel,
  selectInitialPlannerVisionCatalog,
  selectMatchingVisionPair,
  type AiModelCatalogProvider
} from './ai-model-catalog'

const catalog = [
  {
    id: 'planner-only',
    label: 'Planner Only',
    kind: 'openai',
    models: [
      { id: 'p-default', label: 'Planner Default', roles: ['planner'], defaultFor: ['planner'] },
      { id: 'p-extra', label: 'Planner Extra', roles: ['planner'], defaultFor: [] }
    ]
  },
  {
    id: 'vision-only',
    label: 'Vision Only',
    kind: 'openai-compatible',
    models: [{ id: 'v-default', label: 'Vision Default', roles: ['vision'], defaultFor: ['vision'] }]
  },
  {
    id: 'shared',
    label: 'Shared',
    kind: 'ollama',
    models: [
      {
        id: 'shared-default',
        label: 'Shared Default',
        roles: ['planner', 'vision'],
        defaultFor: ['planner', 'vision']
      }
    ]
  }
] satisfies AiModelCatalogProvider[]

describe('AI model catalog', () => {
  it('filters models by role and falls back to provider defaults', () => {
    expect(catalogByRole(catalog, 'planner').map(provider => provider.id)).toEqual(['planner-only', 'shared'])
    const provider = selectCatalogProvider(catalogByRole(catalog, 'planner'), '')
    expect(provider?.id).toBe('planner-only')
    expect(selectCatalogModel(provider, '')?.id).toBe('p-default')
  })

  it('selects explicit and next-provider models together', () => {
    expect(selectCatalogProviderAndModel(catalog, 'planner-only', 'p-extra').model?.id).toBe('p-extra')
    expect(nextCatalogProviderAndModel(catalog, 'vision-only').model?.id).toBe('v-default')
  })

  it('keeps a shared planner and vision model paired when available', () => {
    const initial = selectInitialPlannerVisionCatalog([catalog[2], ...catalog])
    expect(initial.selectedProvider?.id).toBe('shared')
    expect(initial.selectedVisionModel?.id).toBe('shared-default')

    const match = selectMatchingVisionPair({
      plannerProvider: catalog[2],
      plannerModel: catalog[2].models[0],
      visionCatalog: catalogByRole(catalog, 'vision')
    })
    expect(match.model?.id).toBe('shared-default')
  })

  it('formats picker labels', () => {
    expect(aiProviderKindLabel('openai-compatible')).toBe('OpenAI-compatible')
    expect(aiModelDisplayName(catalog[1].models[0])).toBe('Vision Default')
    expect(aiModelSubtitle(catalog[1], catalog[1].models[0])).toBe('OpenAI-compatible · Vision Only')
  })
})
