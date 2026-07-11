import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ToolEventView } from './tool-event-view'
import type { ToolTimelineItem } from '../ai-agent-chat-event-utils'

describe('ToolEventView', () => {
  it('bounds preformatted tool output inside the tool details', () => {
    const item: ToolTimelineItem = {
      type: 'tool',
      key: 'tool_1',
      name: 'android.adbShell',
      status: 'used',
      arguments: [],
      output: [{ key: 'stdout', value: 'line\n'.repeat(200), format: 'pre' }],
      error: null
    }

    render(<ToolEventView item={item} />)

    expect(screen.getByText(/line/).className).toContain('max-h-72')
    expect(screen.getByText(/line/).className).toContain('overflow-auto')
  })
})
