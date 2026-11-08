import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { defaultOrchestratorUiSettings } from '@/shared/model/settings/orchestrator-ui-settings'
import { CreateAppDeviceSection } from './create-app-device-section'
import { getInitialCreateAppFormValues } from './create-app-form-model'

vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }))

describe('effective runtime argument preview', () => {
  it('updates for custom dimensions and copies shell continuations without changing the draft', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    const onChange = vi.fn()
    const values = getInitialCreateAppFormValues(defaultOrchestratorUiSettings)
    const props = {
      images: [],
      values,
      onChange,
      canChangeBaseImage: false,
      canChangeContainerArgs: true,
      isRedroidRuntime: true
    }
    const { rerender } = render(<CreateAppDeviceSection {...props} />)
    fireEvent.click(screen.getByText('Runtime arguments'))
    const preview = screen.getByRole('region', { name: 'Effective arguments Shell' })
    expect(preview.textContent).toContain('androidboot.redroid_width=1080 \\\n')

    rerender(
      <CreateAppDeviceSection
        {...props}
        values={{
          ...values,
          redroidDisplayProfileId: 'custom',
          redroidCustomDisplayWidth: '720',
          redroidCustomDisplayHeight: '1280',
          redroidCustomDisplayDpi: '320',
          redroidExtraArgs: 'androidboot.redroid_fps=30'
        }}
      />
    )
    expect(preview.textContent).toContain('androidboot.redroid_width=720 \\\n')
    expect(preview.textContent).toContain('androidboot.redroid_height=1280 \\\n')
    expect(preview.textContent).toContain('androidboot.redroid_dpi=320 \\\n')
    expect(preview.textContent).not.toMatch(/\\\s*$/)
    expect(screen.getByRole('textbox', { name: 'Additional ReDroid arguments' })).toHaveValue(
      'androidboot.redroid_fps=30'
    )
    fireEvent.click(screen.getByRole('button', { name: 'Wrap' }))
    expect(screen.getByRole('button', { name: 'Wrap' })).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(preview.textContent))
    expect(onChange).not.toHaveBeenCalled()
  })
})
