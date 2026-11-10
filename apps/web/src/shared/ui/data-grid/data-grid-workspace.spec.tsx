import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DataGridEmptyState } from './data-grid-empty-state'
import { DataGridWorkspace } from './data-grid-workspace'

describe('DataGridWorkspace', () => {
  it('renders a search-only workspace without filter chrome', () => {
    render(
      <DataGridWorkspace
        search=''
        searchPlaceholder='Search related rows'
        onSearchChange={() => undefined}
        onSearch={() => undefined}
      >
        <div>Grid content</div>
      </DataGridWorkspace>
    )

    expect(screen.queryByRole('button', { name: 'Filters' })).toBeNull()
    expect(screen.queryByRole('complementary')).toBeNull()
    expect(screen.getByText('Grid content')).toBeTruthy()
  })

  it('describes empty rows using the applied search instead of unsubmitted text', () => {
    const onSearch = vi.fn()
    const renderWorkspace = (appliedSearch: string) => (
      <DataGridWorkspace
        search='typing'
        appliedSearch={appliedSearch}
        searchPlaceholder='Search rows'
        onSearchChange={() => undefined}
        onSearch={onSearch}
      >
        <DataGridEmptyState title='No rows yet' />
      </DataGridWorkspace>
    )
    const { rerender } = render(renderWorkspace(''))
    expect(screen.getByRole('status')).toHaveTextContent('No rows yet')

    rerender(renderWorkspace('typing'))
    expect(screen.getByRole('status')).toHaveTextContent('No matching results')
    fireEvent.click(within(screen.getByRole('status')).getByRole('button', { name: 'Clear search' }))
    expect(onSearch).toHaveBeenLastCalledWith('')
  })

  it('opens filters without replacing the grid and restores focus on dismissal', async () => {
    render(
      <DataGridWorkspace
        search=''
        searchPlaceholder='Search rows'
        onSearchChange={() => undefined}
        onSearch={() => undefined}
        filters={<div>State filter</div>}
        filterTitle='Filter rows'
        onResetFilters={() => undefined}
      >
        <div>Grid content</div>
      </DataGridWorkspace>
    )

    expect(screen.queryByRole('dialog')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Filters' }))

    expect(screen.getByRole('dialog', { name: 'Filter rows' })).toBeVisible()
    expect(screen.getByText('State filter')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(screen.getByRole('button', { name: 'Filters' })).toHaveFocus())
  })

  it('removes active filters and shows contextual bulk actions', () => {
    const onRemove = vi.fn()
    render(
      <DataGridWorkspace
        search=''
        searchPlaceholder='Search rows'
        onSearchChange={() => undefined}
        onSearch={() => undefined}
        filters={<div>State filter</div>}
        activeFilters={[{ id: 'state', label: 'State', value: 'running', onRemove }]}
        onResetFilters={() => undefined}
        selectedCount={2}
        bulkActions={<button type='button'>Stop selected</button>}
      >
        <div>Grid content</div>
      </DataGridWorkspace>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Remove State filter' }))
    expect(onRemove).toHaveBeenCalledOnce()
    expect(screen.getByText('2 selected')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Stop selected' })).toBeTruthy()
  })
})
