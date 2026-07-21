import { describe, expect, it } from 'vitest'
import {
  createProviderModelRows,
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
})
