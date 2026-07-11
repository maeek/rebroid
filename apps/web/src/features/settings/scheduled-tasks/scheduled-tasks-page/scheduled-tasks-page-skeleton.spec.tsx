import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ScheduledTasksPageSkeleton } from './scheduled-tasks-page-skeleton'

describe('ScheduledTasksPageSkeleton', () => {
  it('renders summary cards and a flat grid skeleton', () => {
    render(<ScheduledTasksPageSkeleton />)

    expect(screen.getByTestId('scheduler-summary-skeleton')).toBeTruthy()
    expect(screen.getByTestId('scheduler-grid-skeleton')).toBeTruthy()
    expect(screen.getByTestId('data-grid-skeleton')).toBeTruthy()
    expect(screen.queryByText('Tasks')).toBeNull()
  })
})
