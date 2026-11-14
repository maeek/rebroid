import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FileDropZone } from './file-drop-zone'

describe('FileDropZone', () => {
  it('ignores text drags and delivers file drops only once', () => {
    const onFiles = vi.fn()
    render(
      <FileDropZone onFiles={onFiles}>
        <button type='button'>Upload</button>
      </FileDropZone>
    )
    const upload = screen.getByRole('button', { name: 'Upload' })
    fireEvent.dragEnter(upload, { dataTransfer: { types: ['text/plain'] } })
    expect(screen.queryByRole('status', { name: 'File drop feedback' })).toBeNull()
    const file = new File(['apk'], 'example.apk')
    const dataTransfer = { types: ['Files'], files: [file] }
    fireEvent.dragEnter(upload, { dataTransfer })
    expect(screen.getByRole('status', { name: 'File drop feedback' })).toHaveTextContent('Drop files to upload')
    fireEvent.drop(upload, { dataTransfer })
    expect(onFiles).toHaveBeenCalledExactlyOnceWith([file])
  })

  it('rejects disabled drops and clears the overlay when dragging leaves the window', () => {
    const onFiles = vi.fn()
    const { rerender } = render(
      <FileDropZone onFiles={onFiles}>
        <button type='button'>Upload</button>
      </FileDropZone>
    )
    const upload = screen.getByRole('button', { name: 'Upload' })
    const dataTransfer = { types: ['Files'], files: [new File(['apk'], 'example.apk')] }
    fireEvent.dragEnter(upload, { dataTransfer })
    fireEvent.blur(window)
    expect(screen.queryByRole('status', { name: 'File drop feedback' })).toBeNull()
    rerender(
      <FileDropZone
        onFiles={onFiles}
        disabled
      >
        <button type='button'>Upload</button>
      </FileDropZone>
    )
    fireEvent.drop(upload, { dataTransfer })
    expect(onFiles).not.toHaveBeenCalled()
  })
})
