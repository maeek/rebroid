import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RuntimeFileUploadQueue } from './runtime-file-upload-queue'
import type { RuntimeFileUploadItem } from './use-runtime-file-uploads'

describe('RuntimeFileUploadQueue completion', () => {
  it('waits for the confirmed result after byte transfer and keeps failures retryable', () => {
    const item: RuntimeFileUploadItem = {
      id: 'upload',
      file: new File(['data'], 'document.txt'),
      status: 'uploading',
      progress: 100,
      path: 'document.txt',
      overwrite: false
    }
    const props = { activeCount: 1, onCancel: vi.fn(), onDismiss: vi.fn(), onRetry: vi.fn() }
    const { rerender } = render(
      <RuntimeFileUploadQueue
        {...props}
        items={[item]}
      />
    )
    expect(screen.getByText('Processing…')).toBeVisible()
    expect(screen.queryByText('Complete')).toBeNull()
    rerender(
      <RuntimeFileUploadQueue
        {...props}
        activeCount={0}
        items={[{ ...item, status: 'completed' }]}
      />
    )
    expect(screen.getByText('Complete')).toBeVisible()
    expect(screen.queryByRole('progressbar')).toBeNull()
    rerender(
      <RuntimeFileUploadQueue
        {...props}
        activeCount={0}
        items={[{ ...item, status: 'failed' }]}
      />
    )
    expect(screen.queryByText('Complete')).toBeNull()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeEnabled()
  })
})
