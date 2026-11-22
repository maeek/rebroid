import { expect, it, vi } from 'vitest'
import { uploadFormDataWithProgress } from './upload-form-data-with-progress'

it('rejects an already canceled transfer before contacting the upload endpoint', async () => {
  const xhr = vi.fn(function () {
    throw new Error('Unexpected upload request')
  })
  vi.stubGlobal('XMLHttpRequest', xhr)
  try {
    const transfer = uploadFormDataWithProgress({
      url: '/upload',
      body: new FormData(),
      failureMessage: 'Upload failed.',
      signal: AbortSignal.abort('Device changed')
    })
    await expect(transfer).rejects.toMatchObject({ name: 'AbortError' })
    expect(xhr).not.toHaveBeenCalled()
  } finally {
    vi.unstubAllGlobals()
  }
})
