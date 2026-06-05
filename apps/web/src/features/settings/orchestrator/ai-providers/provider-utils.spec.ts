import { describe, expect, it } from '@jest/globals'
import {
  createProviderModelRows,
  normalizeProviderForm,
  setDefaultProviderModelAt,
  updateProviderModelAt
} from './provider-utils'
import type { AutomationAiProvider } from '@/server/orchestrator/settings/types'

const provider: AutomationAiProvider = {
  id: ' local ',
  label: ' ',
  kind: 'ollama',
  baseUrl: 'http://localhost:11434///',
  apiKey: ' secret ',
  enabled: true,
  models: [
    {
      id: ' qwen ',
      label: ' ',
      settings: {},
      supportsVision: true,
      supportsTools: true,
      enabled: true,
      default: true
    },
    {
      id: ' ',
      label: 'Ignored',
      settings: {},
      supportsVision: false,
      supportsTools: false,
      enabled: false,
      default: false
    }
  ]
}

describe('provider utils', () => {
  it('normalizes provider and model input', () => {
    expect(normalizeProviderForm(provider)).toEqual({
      ...provider,
      id: 'local',
      label: 'local',
      baseUrl: 'http://localhost:11434',
      apiKey: 'secret',
      models: [
        {
          ...provider.models[0],
          id: 'qwen',
          label: 'qwen',
          supportsVision: false,
          supportsTools: true
        }
      ]
    })
  })

  it('creates stable editable model rows', () => {
    expect(createProviderModelRows(normalizeProviderForm(provider).models)).toEqual([
      expect.objectContaining({ id: 'qwen', index: 0, rowId: '0:qwen' })
    ])
  })

  it('updates and defaults model rows', () => {
    const models = [
      { ...normalizeProviderForm(provider).models[0], default: true },
      { ...normalizeProviderForm(provider).models[0], id: 'other', default: false }
    ]

    expect(updateProviderModelAt(models, 1, { default: true }).map(model => model.default)).toEqual([false, true])
    expect(setDefaultProviderModelAt(models, 1).map(model => model.default)).toEqual([false, true])
  })
})
