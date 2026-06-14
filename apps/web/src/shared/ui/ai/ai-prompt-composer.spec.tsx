import { describe, expect, it, jest } from '@jest/globals'
import { fireEvent, render, screen } from '@testing-library/react'
import { Button } from '@/components/ui/button'
import { AiModelPicker } from './ai-model-picker'
import { AiPromptComposer } from './ai-prompt-composer'
import type { AutomationAiModelCatalogProvider } from '@/server/orchestrator/settings/types'

const catalog = [
  {
    id: 'local',
    label: 'Local Ollama',
    kind: 'ollama',
    models: [
      {
        id: 'qwen',
        label: 'Qwen',
        roles: ['planner'],
        default: true,
        enabled: true,
        settings: {}
      }
    ]
  },
  {
    id: 'cloud',
    label: 'Cloud',
    kind: 'openai-compatible',
    models: [
      {
        id: 'fast',
        label: 'Fast',
        roles: ['planner'],
        default: true,
        enabled: true,
        settings: {}
      }
    ]
  }
] satisfies AutomationAiModelCatalogProvider[]

describe('AiPromptComposer', () => {
  it('renders model control, errors, actions, and submits from keyboard', () => {
    const onChange = jest.fn()
    const onSubmit = jest.fn()

    render(
      <AiPromptComposer
        value='hello'
        placeholder='Ask AI'
        metadata='Run timeout: 5 minutes.'
        modelControl={<button type='button'>Qwen</button>}
        actions={<Button>Send</Button>}
        errors={['Select a model']}
        onChange={onChange}
        onSubmit={onSubmit}
      />
    )

    expect(screen.getByText('Qwen')).toBeTruthy()
    expect(screen.getByText('Run timeout: 5 minutes.')).toBeTruthy()
    expect(screen.getByText('Select a model')).toBeTruthy()

    fireEvent.change(screen.getByPlaceholderText('Ask AI'), { target: { value: 'next' } })
    expect(onChange).toHaveBeenCalledWith('next')

    fireEvent.keyDown(screen.getByPlaceholderText('Ask AI'), { key: 'Enter', metaKey: true })
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })
})

describe('AiModelPicker', () => {
  it('shows the selected model chip', () => {
    render(
      <AiModelPicker
        catalog={catalog}
        selectedProvider={catalog[0]}
        selectedModel={catalog[0]?.models[0]}
        defaultOpen
        onProviderChange={jest.fn()}
        onModelChange={jest.fn()}
      />
    )

    expect(screen.getByText('Qwen')).toBeTruthy()
    expect(screen.getByText('Local Ollama · Ollama')).toBeTruthy()
  })

  it('shows an empty catalog state', () => {
    render(
      <AiModelPicker
        catalog={[]}
        defaultOpen
        onProviderChange={jest.fn()}
        onModelChange={jest.fn()}
      />
    )

    expect(screen.getByText('No model')).toBeTruthy()
    expect(screen.getByText('No enabled AI provider or model is configured.')).toBeTruthy()
  })
})
