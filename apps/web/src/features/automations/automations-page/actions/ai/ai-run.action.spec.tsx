import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useAiModelCatalogSelection } from '@/shared/ui/ai/use-ai-model-catalog-selection'
import { aiRunAction } from './ai-run.action'

vi.mock('@/shared/ui/ai/use-ai-model-catalog-selection')

describe('AI run capability overrides', () => {
  it('offers reset for an explicit empty override and returns focus to Customize capabilities', () => {
    vi.mocked(useAiModelCatalogSelection).mockReturnValue({
      catalog: [],
      primaryCatalog: [],
      visionCatalog: [],
      selectedProvider: undefined,
      selectedModel: undefined,
      selectedVisionProvider: undefined,
      selectedVisionModel: undefined,
      isLoadingCatalog: false,
      health: null,
      isCheckingHealth: false,
      setProviderId: vi.fn(),
      setModelId: vi.fn(),
      setVisionProviderId: vi.fn(),
      setVisionModelId: vi.fn(),
      recheckHealth: vi.fn()
    })

    const Editor = () => {
      const [input, setInput] = useState<Record<string, unknown>>({ capabilities: [] })
      return aiRunAction.renderEditor({
        commands: [],
        input,
        uiState: {},
        patchInput: patch => setInput(current => ({ ...current, ...patch })),
        replaceInput: setInput,
        patchUiState: vi.fn()
      })
    }

    render(<Editor />)
    const resetName = 'Reset allowed capabilities to defaults'
    expect(screen.getByRole('combobox', { name: 'Allowed capabilities' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: resetName }))

    const customize = screen.getByRole('button', { name: 'Customize capabilities' })
    expect(customize).toHaveFocus()
    expect(screen.queryByRole('button', { name: resetName })).not.toBeInTheDocument()

    fireEvent.click(customize)
    expect(screen.getByRole('button', { name: resetName })).toBeVisible()
  })
})
