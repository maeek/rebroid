import { render, screen } from '@testing-library/react'
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

  it('links a failure directly to its run trace', () => {
    render(
      <WorkflowRunResult
        status='failed'
        at='2026-11-08T09:00:00Z'
        error='Device did not become ready before the startup deadline.'
        workflowId='example workflow'
        runId='failed-run'
      />
    )
    expect(screen.queryByText(/Device did not become ready/)).toBeNull()
    expect(screen.getByRole('link', { name: 'View failure' })).toHaveAttribute(
      'href',
      '/automations/example%20workflow/traces?run=failed-run'
    )
  })
})
