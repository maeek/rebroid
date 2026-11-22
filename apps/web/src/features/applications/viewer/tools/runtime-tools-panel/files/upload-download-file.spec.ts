import { runtimeFileUploadLimit } from '@rebroid/android-application-core/redroid-runtime'
import { expect, it, vi } from 'vitest'
import { uploadFormDataWithProgress } from '@/lib/http/upload-form-data-with-progress'
import { actionOk } from '@/shared/actions/action-result'
import { uploadDownloadFileWithProgress } from './upload-download-file'

vi.mock('@/lib/http/upload-form-data-with-progress', () => ({ uploadFormDataWithProgress: vi.fn() }))

it('accepts the exact file limit and rejects the next byte before starting a request', async () => {
  const file = new File([], 'notes.txt')
  const size = vi.spyOn(file, 'size', 'get')
  const maximum = runtimeFileUploadLimit.bytes
  const transfer = () => uploadDownloadFileWithProgress({ appId: 'app', path: '/data', file })
  vi.mocked(uploadFormDataWithProgress).mockResolvedValue(actionOk({ uploaded: true }))
  size.mockReturnValue(maximum)
  await expect(transfer()).resolves.toEqual({ uploaded: true })
  size.mockReturnValue(maximum + 1)
  await expect(transfer()).rejects.toThrow('256 MB limit')
  expect(uploadFormDataWithProgress).toHaveBeenCalledTimes(1)
})
