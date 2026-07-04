import { describe, expect, it, jest } from '@jest/globals'
import { fireEvent, render, screen } from '@testing-library/react'
import { RuntimeToolTabs } from './runtime-tool-tabs'
import type { RuntimeToolDefinition } from './runtime-tool-definitions'

const Icon = ({ className }: { className?: string }) => <span className={className} />

const tools: RuntimeToolDefinition[] = [
  { id: 'streaming', title: 'Streaming', description: 'Streaming', Icon },
  { id: 'network-access', title: 'Network access', description: 'Network', Icon },
  { id: 'logs', title: 'Logs', description: 'Logs', Icon }
]

describe('RuntimeToolTabs', () => {
  it('moves focus and selection with arrow keys', () => {
    const onSelectTool = jest.fn()
    render(
      <RuntimeToolTabs
        tools={tools}
        selectedToolId='streaming'
        onSelectTool={onSelectTool}
      />
    )

    fireEvent.keyDown(screen.getByRole('tab', { name: 'Streaming' }), { key: 'ArrowRight' })

    expect(onSelectTool).toHaveBeenCalledWith('network-access')
    expect(screen.getByRole('tab', { name: 'Network access' }).matches(':focus')).toBe(true)
  })

  it('wraps from the first tab to the last tab', () => {
    const onSelectTool = jest.fn()
    render(
      <RuntimeToolTabs
        tools={tools}
        selectedToolId='streaming'
        onSelectTool={onSelectTool}
      />
    )

    fireEvent.keyDown(screen.getByRole('tab', { name: 'Streaming' }), { key: 'ArrowLeft' })

    expect(onSelectTool).toHaveBeenCalledWith('logs')
    expect(screen.getByRole('tab', { name: 'Logs' }).matches(':focus')).toBe(true)
  })
})
