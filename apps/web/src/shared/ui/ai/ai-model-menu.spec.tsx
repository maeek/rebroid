import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AiModelMenu } from './ai-model-menu'
import type { AutomationAiModelCatalogProvider } from '@/shared/contracts/ai-provider'

const provider: AutomationAiModelCatalogProvider = {
  id: 'local',
  label: 'Local server',
  kind: 'ollama',
  models: Array.from({ length: 8 }, (_, index) => ({
    id: `model-${index}`,
    label: `Model ${index}`,
    enabled: true,
    roles: ['planner'],
    defaultFor: [],
    settings: {}
  }))
}

describe('AiModelMenu', () => {
  it('searches names and provider labels and keeps the exact provider/model pair', () => {
    const onSelect = vi.fn()
    render(
      <AiModelMenu
        catalog={[provider]}
        providerId='local'
        modelId='model-2'
        onSelect={onSelect}
      />
    )
    expect(screen.getByRole('button', { name: 'Model 2', pressed: true })).toBeVisible()
    const search = screen.getByRole('textbox', { name: 'Search models' })
    fireEvent.change(search, { target: { value: 'model-7' } })
    expect(screen.queryByRole('button', { name: 'Model 2' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Model 7' }))
    expect(onSelect).toHaveBeenCalledWith('local', 'model-7')
    fireEvent.change(search, { target: { value: 'no match' } })
    expect(screen.getByRole('status')).toHaveTextContent('No matching models.')
    fireEvent.change(search, { target: { value: 'Local server' } })
    expect(screen.getAllByRole('button')).toHaveLength(8)
  })
})
