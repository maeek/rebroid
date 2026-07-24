import type { PropsWithChildren } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UploadRequestError } from '@/lib/http/upload-form-data-with-progress'
import { useRuntimeFileUploads } from './use-runtime-file-uploads'

const mocks = vi.hoisted(() => ({ upload: vi.fn() }))

vi.mock('./upload-download-file', () => ({
  uploadDownloadFileWithProgress: mocks.upload
}))

vi.mock('./use-runtime-file-browser', () => ({
  runtimeFilesQueryKey: (appId: string, path: string) => ['runtime-files', appId, path]
}))

const deferred = <T,>() => {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve
    reject = onReject
  })
  return { promise, reject, resolve }
}

const uploadedFile = (name: string, path = '/data/Documents') => ({
  uploaded: true,
  name,
  path: `${path}/${name}`,
  type: 'file' as const,
  sizeBytes: 1,
  itemCount: null,
  modifiedAt: '2026-07-22T00:00:00.000Z'
})

describe('useRuntimeFileUploads', () => {
  let queryClient: QueryClient
  let wrapper: (props: PropsWithChildren) => React.ReactNode

  beforeEach(() => {
    mocks.upload.mockReset()
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    wrapper = ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  })

  it('captures the destination and runs no more than two uploads concurrently', async () => {
    const first = deferred<ReturnType<typeof uploadedFile>>()
    const second = deferred<ReturnType<typeof uploadedFile>>()
    const third = deferred<ReturnType<typeof uploadedFile>>()
    mocks.upload.mockImplementationOnce(() => first.promise)
    mocks.upload.mockImplementationOnce(() => second.promise)
    mocks.upload.mockImplementationOnce(() => third.promise)
    const { result } = renderHook(() => useRuntimeFileUploads('app-1'), { wrapper })

    act(() => {
      result.current.addFiles(
        [new File(['a'], 'a.txt'), new File(['b'], 'b.txt'), new File(['c'], 'c.txt')],
        '/data/Documents'
      )
    })

    await waitFor(() => expect(mocks.upload).toHaveBeenCalledTimes(2))
    expect(mocks.upload.mock.calls[0]?.[0]).toMatchObject({ path: '/data/Documents' })
    expect(mocks.upload.mock.calls[1]?.[0]).toMatchObject({ path: '/data/Documents' })

    act(() => first.resolve(uploadedFile('a.txt')))
    await waitFor(() => expect(mocks.upload).toHaveBeenCalledTimes(3))
    expect(mocks.upload.mock.calls[2]?.[0]).toMatchObject({ path: '/data/Documents' })

    act(() => {
      second.resolve(uploadedFile('b.txt'))
      third.resolve(uploadedFile('c.txt'))
    })
  })

  it('supports cancel and an explicit Replace retry after a conflict', async () => {
    const pending = deferred<ReturnType<typeof uploadedFile>>()
    mocks.upload.mockImplementationOnce(() => pending.promise)
    mocks.upload.mockRejectedValueOnce(new UploadRequestError('File already exists.', 409))
    mocks.upload.mockResolvedValueOnce(uploadedFile('existing.txt'))
    const { result } = renderHook(() => useRuntimeFileUploads('app-1'), { wrapper })

    act(() => result.current.addFiles([new File(['x'], 'cancel.txt')], '/data'))
    await waitFor(() => expect(mocks.upload).toHaveBeenCalledTimes(1))
    const cancelItem = result.current.items[0]
    if (!cancelItem) throw new Error('Expected a queued upload.')
    const cancelId = cancelItem.id
    act(() => result.current.cancel(cancelId))
    const uploadOptions: unknown = mocks.upload.mock.calls[0]?.[0]
    if (
      !uploadOptions ||
      typeof uploadOptions !== 'object' ||
      !('signal' in uploadOptions) ||
      !(uploadOptions.signal instanceof AbortSignal)
    ) {
      throw new Error('Expected upload options with an abort signal.')
    }
    expect(uploadOptions.signal.aborted).toBe(true)
    pending.reject(new DOMException('Upload canceled.', 'AbortError'))
    await waitFor(() => expect(result.current.items[0]?.status).toBe('canceled'))

    act(() => result.current.addFiles([new File(['x'], 'existing.txt')], '/data'))
    await waitFor(() => expect(result.current.items[1]?.status).toBe('conflict'))
    const conflictItem = result.current.items[1]
    if (!conflictItem) throw new Error('Expected a conflicting upload.')
    const conflictId = conflictItem.id
    act(() => result.current.retry(conflictId, true))
    await waitFor(() => expect(mocks.upload).toHaveBeenCalledTimes(3))
    expect(mocks.upload.mock.calls[2]?.[0]).toMatchObject({ overwrite: true, path: '/data' })
  })
})
