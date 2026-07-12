import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
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

  it('renders its desktop filter surface open by default', () => {
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

    expect(screen.getByRole('complementary', { name: 'Filter rows' })).toBeTruthy()
    expect(screen.getByText('State filter')).toBeTruthy()
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
