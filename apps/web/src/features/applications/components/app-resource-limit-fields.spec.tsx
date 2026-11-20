import { useState } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AppResourceLimitFields } from './app-resource-limit-fields'
import type { ResourceLimitBounds } from '@/shared/contracts/system-resources'

const resourceLimits: ResourceLimitBounds = {
  maxCpuCpus: 8,
  maxMemoryMb: 4096,
  hostCpuCores: 16,
  hostMemoryBytes: 32 * 1024 ** 3
}

describe('AppResourceLimitFields', () => {
  it('describes the host totals, keeps quota-based bounds, and forwards field updates', () => {
    const onChange = vi.fn()
    render(
      <TooltipProvider>
        <AppResourceLimitFields
          values={{ memoryLimitMb: '256', cpuLimitCpus: '1' }}
          resourceLimits={resourceLimits}
          onChange={onChange}
        />
      </TooltipProvider>
    )

    const ram = screen.getByRole('spinbutton', { name: 'RAM limit' })
    const cpu = screen.getByRole('spinbutton', { name: 'CPU limit' })
    expect(ram).toHaveAccessibleDescription('In MB. Blank uses the default. Host total 32 GiB')
    expect(cpu).toHaveAccessibleDescription('Cores can be fractional. Blank for default. Host total 16 logical CPUs')
    expect(ram).toHaveAttribute('max', '4096')
    expect(cpu).toHaveAttribute('max', '8')
    expect(screen.getByRole('slider', { name: 'Adjust RAM limit' })).toHaveAttribute('max', '4096')
    expect(screen.getByRole('slider', { name: 'Adjust CPU limit' })).toHaveAttribute('max', '8')

    fireEvent.change(ram, { target: { value: '512' } })
    fireEvent.change(cpu, { target: { value: '2' } })

    expect(onChange).toHaveBeenCalledWith({ memoryLimitMb: '512' })
    expect(onChange).toHaveBeenCalledWith({ cpuLimitCpus: '2' })
  })

  it('keeps capacity guidance out of the input description until it is available', () => {
    const fields = (bounds: ResourceLimitBounds | null) => (
      <AppResourceLimitFields
        values={{ memoryLimitMb: '', cpuLimitCpus: '' }}
        resourceLimits={bounds}
        onChange={vi.fn()}
      />
    )
    const { rerender } = render(fields(null))
    const ram = screen.getByRole('spinbutton', { name: 'RAM limit' })
    const cpu = screen.getByRole('spinbutton', { name: 'CPU limit' })
    expect(ram).toHaveAccessibleDescription('In MB. Blank uses the default.')
    expect(screen.queryByRole('slider')).not.toBeInTheDocument()

    rerender(fields({ hostMemoryBytes: null, hostCpuCores: 1, maxMemoryMb: 4096, maxCpuCpus: 1 }))
    expect(ram).toHaveAccessibleDescription('In MB. Blank uses the default. Host total unavailable')
    expect(cpu).toHaveAccessibleDescription('Cores can be fractional. Blank for default. Host total 1 logical CPU')
  })

  it('only offers resets for populated limits and returns focus to the cleared field', async () => {
    const Fields = () => {
      const [values, setValues] = useState({ memoryLimitMb: '', cpuLimitCpus: '1.5' })

      return (
        <TooltipProvider>
          <AppResourceLimitFields
            values={values}
            resourceLimits={resourceLimits}
            onChange={patch => setValues(previous => ({ ...previous, ...patch }))}
          />
        </TooltipProvider>
      )
    }

    render(<Fields />)

    const memory = screen.getByRole('spinbutton', { name: 'RAM limit' })
    const cpu = screen.getByRole('spinbutton', { name: 'CPU limit' })
    const memorySlider = screen.getByRole('slider', { name: 'Adjust RAM limit' })
    const cpuSlider = screen.getByRole('slider', { name: 'Adjust CPU limit' })

    expect(screen.queryByRole('button', { name: 'Reset RAM limit to default' })).not.toBeInTheDocument()
    expect(memorySlider).toHaveAttribute('aria-valuetext', 'Default')
    fireEvent.change(memory, { target: { value: '512' } })
    expect(memorySlider).toHaveAttribute('aria-valuenow', '512')
    const resetMemory = screen.getByRole('button', { name: 'Reset RAM limit to default' })
    act(() => resetMemory.focus())
    expect(await screen.findByText('Reset RAM limit to default')).toBeInTheDocument()
    fireEvent.click(resetMemory)

    expect(memory).toHaveValue(null)
    expect(memory).toHaveFocus()
    expect(memorySlider).toHaveAttribute('aria-valuetext', 'Default')
    expect(cpu).toHaveValue(1.5)
    expect(screen.queryByRole('button', { name: 'Reset RAM limit to default' })).not.toBeInTheDocument()

    fireEvent.keyDown(cpuSlider, { key: 'ArrowRight' })
    expect(cpu).toHaveValue(1.6)
    fireEvent.click(screen.getByRole('button', { name: 'Reset CPU limit to default' }))
    expect(cpu).toHaveValue(null)
    expect(cpu).toHaveFocus()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
