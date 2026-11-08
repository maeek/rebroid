import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DataGrid } from './data-grid'
import { DataGridEmptyState } from './data-grid-empty-state'
import { DataGridWorkspace } from './data-grid-workspace'

describe('grid feedback', () => {
  it('keeps empty feedback outside scrolling table markup with column headers intact', () => {
    render(
      <DataGrid
        columns={[{ accessorKey: 'name', header: 'Name' }]}
        data={[] as { id: string; name: string }[]}
        totalItems={0}
        pageIndex={0}
        pageSize={20}
        getRowId={row => row.id}
        emptyState={
          <DataGridEmptyState
            title='No models added'
            description='Add a model from this provider.'
          />
        }
      />
    )
    expect(screen.getByRole('columnheader', { name: /Name/ })).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent('No models added')
    expect(within(screen.getByRole('table')).queryByRole('status')).toBeNull()
    expect(screen.queryByRole('button', { name: /Clear/ })).toBeNull()
  })

  it('clears search and structured filters independently through their owning callbacks', () => {
    const searchDraft = vi.fn()
    const search = vi.fn()
    const reset = vi.fn()
    render(
      <DataGridWorkspace
        search='missing app'
        searchPlaceholder='Search apps'
        onSearchChange={searchDraft}
        onSearch={search}
        activeFilters={[{ id: 'state', label: 'State', value: 'running', onRemove: vi.fn() }]}
        onResetFilters={reset}
      >
        <DataGridEmptyState title='No apps yet' />
      </DataGridWorkspace>
    )
    expect(screen.getByRole('status')).toHaveTextContent('No matching results')
    expect(screen.queryByText('No apps yet')).toBeNull()
    fireEvent.click(within(screen.getByRole('status')).getByRole('button', { name: 'Clear search' }))
    expect(searchDraft).toHaveBeenCalledExactlyOnceWith('')
    expect(search).toHaveBeenCalledExactlyOnceWith('')
    expect(reset).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(reset).toHaveBeenCalledOnce()
  })

  it('does not offer filter mutations during loading or show first-use actions for filtered results', () => {
    render(
      <DataGridWorkspace
        search='missing'
        searchPlaceholder='Search'
        onSearchChange={vi.fn()}
        onSearch={vi.fn()}
        disabled
      >
        <DataGridEmptyState actions={[{ label: 'Add model', onClick: vi.fn() }]} />
      </DataGridWorkspace>
    )
    expect(screen.getByRole('heading', { name: 'No matching results' })).toBeVisible()
    expect(within(screen.getByRole('status')).queryByRole('button', { name: 'Clear search' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Add model' })).toBeNull()
  })
})
