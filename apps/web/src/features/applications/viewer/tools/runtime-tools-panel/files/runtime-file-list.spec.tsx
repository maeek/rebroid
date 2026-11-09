import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { RuntimeFileList } from './runtime-file-list'
import type { ApplicationRuntimeFile } from '@/shared/contracts/application'

it('moves focus between visible file names without opening a file or paging', () => {
  const files = Array.from({ length: 21 }, (_, index): ApplicationRuntimeFile => ({
    name: `File ${index + 1}`,
    path: `/data/file-${index + 1}`,
    type: 'file',
    sizeBytes: 1024,
    modifiedAt: null,
    itemCount: null
  }))
  const onOpen = vi.fn()
  render(
    <RuntimeFileList
      files={files}
      canManageFiles
      error={null}
      loading={false}
      searchQuery=''
      sort='name'
      sortDirection='asc'
      onDelete={vi.fn()}
      onDownload={vi.fn()}
      onOpen={onOpen}
      onPrefetch={vi.fn()}
      onRefresh={vi.fn()}
      onRename={vi.fn()}
      onSearchChange={vi.fn()}
      onSort={vi.fn()}
    />
  )

  const first = screen.getByRole('button', { name: 'File 1' })
  const second = screen.getByRole('button', { name: 'File 2' })
  const last = screen.getByRole('button', { name: 'File 20' })
  first.focus()
  fireEvent.keyDown(first, { key: 'ArrowDown' })
  expect(second).toHaveFocus()
  fireEvent.keyDown(second, { key: 'ArrowUp' })
  expect(first).toHaveFocus()
  fireEvent.keyDown(first, { key: 'End' })
  expect(last).toHaveFocus()
  fireEvent.keyDown(last, { key: 'ArrowDown' })
  expect(last).toHaveFocus()
  fireEvent.keyDown(last, { key: 'Home' })
  expect(first).toHaveFocus()
  expect(onOpen).not.toHaveBeenCalled()
})
