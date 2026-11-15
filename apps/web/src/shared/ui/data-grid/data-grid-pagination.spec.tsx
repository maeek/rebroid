import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DataGridPagination } from './data-grid-pagination'

describe('DataGridPagination', () => {
  it('leaves the empty state as the final content when there are no results', () => {
    const { container } = render(
      <DataGridPagination
        pageIndex={0}
        pageSize={20}
        totalItems={0}
        onPageIndexChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />
    )

    expect(container).toBeEmptyDOMElement()
  })

  it('shows just the count when every supported page size fits the results', () => {
    render(
      <DataGridPagination
        pageIndex={0}
        pageSize={20}
        totalItems={2}
        itemLabels={{ singular: 'workflow', plural: 'workflows' }}
        onPageIndexChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />
    )

    expect(screen.getByText('2 workflows')).toBeVisible()
    expect(screen.queryByRole('combobox', { name: 'Rows per page' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Next page' })).not.toBeInTheDocument()
  })

  it('keeps page size available when another size would paginate the results', () => {
    render(
      <DataGridPagination
        pageIndex={0}
        pageSize={100}
        totalItems={25}
        onPageIndexChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />
    )

    expect(screen.getByText('25 results')).toBeVisible()
    expect(screen.getByRole('combobox', { name: 'Rows per page' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Next page' })).not.toBeInTheDocument()
  })

  it.each([50, 100])('requests %i rows without a competing page navigation', pageSize => {
    const onPageIndexChange = vi.fn()
    const onPageSizeChange = vi.fn()
    render(
      <DataGridPagination
        pageIndex={1}
        pageSize={20}
        totalItems={150}
        onPageIndexChange={onPageIndexChange}
        onPageSizeChange={onPageSizeChange}
      />
    )

    fireEvent.click(screen.getByRole('combobox', { name: 'Rows per page' }))
    const option = screen.getByRole('option', { name: String(pageSize) })
    fireEvent.pointerDown(option)
    fireEvent.click(option)

    expect(onPageSizeChange).toHaveBeenCalledExactlyOnceWith(pageSize)
    expect(onPageIndexChange).not.toHaveBeenCalled()
  })
})
