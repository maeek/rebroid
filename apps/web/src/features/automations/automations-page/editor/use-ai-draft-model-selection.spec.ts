import { describe, expect, it } from '@jest/globals'
import { selectAiDraftProviderAndModel } from './ai-draft-model-selection-utils'
import type { AutomationAiModelCatalogProvider } from '@/server/orchestrator/settings/types'

const catalog = [
  {
    id: 'local',
    label: 'Local',
    kind: 'ollama',
    models: [
      {
        id: 'small',
        label: 'Small',
        roles: ['planner'],
        settings: {},
        defaultFor: [],
        enabled: true
      },
      {
        id: 'vision',
        label: 'Vision',
        roles: ['planner', 'vision'],
        settings: {},
        defaultFor: ['planner'],
        enabled: true
      }
    ]
  },
  {
    id: 'cloud',
    label: 'Cloud',
    kind: 'openai',
    models: [
      {
        id: 'fast',
        label: 'Fast',
        roles: ['planner'],
        settings: {},
        defaultFor: [],
        enabled: true
      }
    ]
  }
] satisfies AutomationAiModelCatalogProvider[]

describe('AI draft model selection', () => {
  it('selects requested provider and model', () => {
    const selected = selectAiDraftProviderAndModel(catalog, 'cloud', 'fast')

    expect(selected.provider?.id).toBe('cloud')
    expect(selected.model?.id).toBe('fast')
  })

  it('falls back to provider default model', () => {
    const selected = selectAiDraftProviderAndModel(catalog, 'local', 'missing')

    expect(selected.provider?.id).toBe('local')
    expect(selected.model?.id).toBe('vision')
  })
})
