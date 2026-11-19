import { useState } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AppResourceLimitFields } from './app-resource-limit-fields'
import type { ResourceLimitBounds } from '@/shared/contracts/system-resources'

describe('AppResourceLimitFields', () => {
  it('forwards memory and cpu updates', () => {
    const onChange = vi.fn()
    const resourceLimits: ResourceLimitBounds = {
      maxCpuCpus: 8,
      maxMemoryMb: 4096
    }

    render(
      <TooltipProvider>
        <AppResourceLimitFields
          values={{ memoryLimitMb: '256', cpuLimitCpus: '1' }}
          resourceLimits={resourceLimits}
          onChange={onChange}
        />
      </TooltipProvider>
    )

    fireEvent.change(screen.getByRole('spinbutton', { name: 'RAM limit' }), { target: { value: '512' } })
    fireEvent.change(screen.getByRole('spinbutton', { name: 'CPU limit' }), { target: { value: '2' } })

    expect(onChange).toHaveBeenCalledWith({ memoryLimitMb: '512' })
    expect(onChange).toHaveBeenCalledWith({ cpuLimitCpus: '2' })
  })

  it('only offers resets for populated limits and returns focus to the cleared field', async () => {
    const Fields = () => {
      const [values, setValues] = useState({ memoryLimitMb: '', cpuLimitCpus: '1.5' })

      return (
        <TooltipProvider>
          <AppResourceLimitFields
            values={values}
            resourceLimits={null}
            onChange={patch => setValues(previous => ({ ...previous, ...patch }))}
          />
        </TooltipProvider>
      )
    }

    render(<Fields />)

    const memory = screen.getByRole('spinbutton', { name: 'RAM limit' })
    const cpu = screen.getByRole('spinbutton', { name: 'CPU limit' })

    expect(screen.queryByRole('button', { name: 'Reset RAM limit to default' })).not.toBeInTheDocument()
    fireEvent.change(memory, { target: { value: '512' } })
    const resetMemory = screen.getByRole('button', { name: 'Reset RAM limit to default' })
    act(() => resetMemory.focus())
    expect(await screen.findByText('Reset RAM limit to default')).toBeInTheDocument()
    fireEvent.click(resetMemory)

    expect(memory).toHaveValue(null)
    expect(memory).toHaveFocus()
    expect(cpu).toHaveValue(1.5)
    expect(screen.queryByRole('button', { name: 'Reset RAM limit to default' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Reset CPU limit to default' }))
    expect(cpu).toHaveValue(null)
    expect(cpu).toHaveFocus()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
