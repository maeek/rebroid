import { describe, expect, it } from 'vitest'
import {
  createProviderModelRows,
  createProviderDraft,
  normalizeProviderForm,
  setDefaultProviderModelAt,
  updateProviderModelAt,
  type ProviderFormState
} from './provider-form-model'

const provider: ProviderFormState = {
  id: ' local ',
  label: ' ',
  kind: 'ollama',
  protocol: 'openai-chat-completions',
  serverFlavor: 'auto',
  baseUrl: 'http://localhost:11434///',
  apiKey: ' secret ',
  enabled: true,
  models: [
    {
      id: ' qwen ',
      label: ' ',
      roles: ['planner'],
      settings: {},
      enabled: true,
      defaultFor: ['planner']
    }
  ]
}

describe('AI provider form model', () => {
  it('starts OpenAI with an available planning preset and generates unused provider IDs', () => {
    expect(createProviderDraft('openai', ['openai', 'openai-2'])).toMatchObject({
      id: 'openai-3',
      kind: 'openai',
      label: 'OpenAI',
      enabled: true,
      models: [{ id: 'gpt-5.6-luna', defaultFor: ['controller', 'planner'], enabled: true }]
    })
    expect(createProviderDraft('ollama')).toMatchObject({
      protocol: 'ollama-native-chat',
      baseUrl: 'http://localhost:11434',
      models: []
    })
  })
  it('normalizes editable provider values', () => {
    expect(normalizeProviderForm(provider)).toMatchObject({
      id: 'local',
      label: 'local',
      baseUrl: 'http://localhost:11434',
      apiKey: 'secret',
      models: [{ id: 'qwen', label: 'qwen' }]
    })
  })

  it('creates stable rows and keeps one selected default per role', () => {
    const normalized = normalizeProviderForm(provider).models[0]
    expect(createProviderModelRows([normalized])[0].rowId).toBe('0:qwen')

    const models = [normalized, { ...normalized, id: 'other', defaultFor: [] }]
    expect(updateProviderModelAt(models, 1, { defaultFor: ['planner'] }).map(model => model.defaultFor)).toEqual([
      [],
      ['planner']
    ])
    expect(setDefaultProviderModelAt(models, 1, 'planner').map(model => model.defaultFor)).toEqual([[], ['planner']])
  })

  it('does not mutate or clear other models when changing a model purpose', () => {
    const models = [
      { ...provider.models[0], id: 'planner', roles: ['planner' as const], defaultFor: ['planner' as const] },
      { ...provider.models[0], id: 'vision', roles: ['vision' as const], defaultFor: ['vision' as const] }
    ]
    const before = structuredClone(models)
    const updated = updateProviderModelAt(models, 0, { roles: ['controller'] })
    expect(updated[0].defaultFor).toEqual([])
    expect(updated[1].defaultFor).toEqual(['vision'])
    expect(models).toEqual(before)
  })
})
