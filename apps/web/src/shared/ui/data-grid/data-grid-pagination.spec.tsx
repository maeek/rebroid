import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DataGridPagination } from './data-grid-pagination'

describe('DataGridPagination', () => {
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
