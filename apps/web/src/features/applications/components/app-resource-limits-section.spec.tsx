import { describe, expect, it, jest } from '@jest/globals'
import { fireEvent, render, screen } from '@testing-library/react'
import { AppResourceLimitsSection } from './app-resource-limits-section'
import type { ResourceLimitBounds } from '@/server/orchestrator/diagnostics/resource-limits'

jest.mock('@/components/ui/number-slider-field', () => ({
  NumberSliderField: ({ value, onValueChange }: { value: string; onValueChange: (value: string) => void }) => (
    <input
      value={value}
      onChange={event => onValueChange(event.target.value)}
    />
  )
}))

describe('AppResourceLimitsSection', () => {
  it('forwards memory and cpu updates', () => {
    const onChange = jest.fn()
    const resourceLimits: ResourceLimitBounds = {
      maxCpuCpus: 8,
      maxMemoryMb: 4096
    }

    render(
      <AppResourceLimitsSection
        values={{ memoryLimitMb: '256', cpuLimitCpus: '1' }}
        resourceLimits={resourceLimits}
        onChange={onChange}
      />
    )

    const inputs = screen.getAllByRole('textbox')
    fireEvent.change(inputs[0], { target: { value: '512' } })
    fireEvent.change(inputs[1], { target: { value: '2' } })

    expect(onChange).toHaveBeenCalledWith({ memoryLimitMb: '512' })
    expect(onChange).toHaveBeenCalledWith({ cpuLimitCpus: '2' })
  })
})
