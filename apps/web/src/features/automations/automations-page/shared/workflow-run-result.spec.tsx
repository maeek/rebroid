import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { WorkflowRunResult } from './workflow-run-result'

describe('WorkflowRunResult', () => {
  it('shows one empty result without a redundant badge or timestamp', () => {
    render(
      <WorkflowRunResult
        status='never_run'
        at={null}
        error={null}
        workflowId='example'
      />
    )
    expect(screen.getAllByText('Never run')).toHaveLength(1)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('keeps long failures out of the grid and opens their full evidence on demand', async () => {
    render(
      <WorkflowRunResult
        status='failed'
        at='2026-11-08T09:00:00Z'
        error='Device did not become ready before the startup deadline.'
        workflowId='example workflow'
      />
    )
    expect(screen.queryByText(/Device did not become ready/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'View failure' }))
    const dialog = await screen.findByRole('dialog', { name: 'Last run failure' })
    expect(within(dialog).getByText('Device did not become ready before the startup deadline.')).toBeVisible()
    expect(within(dialog).getByRole('link', { name: 'Open run history' })).toHaveAttribute(
      'href',
      '/automations/example%20workflow/traces'
    )
  })
})
