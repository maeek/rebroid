import { readFile, unlink } from 'node:fs/promises'
import { expect, it, vi } from 'vitest'
import { getStoredAppIcon, removeStoredAppIcon, setStoredAppIcon } from './store'

vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn(),
  readFile: vi.fn(),
  unlink: vi.fn(),
  writeFile: vi.fn()
}))

it('shares a single metadata read across concurrent requests and reuses the result', async () => {
  const url = '/api/app-icons/cached-app'
  vi.mocked(readFile).mockResolvedValue(JSON.stringify({ icon: url }))

  await expect(Promise.all([getStoredAppIcon('cached-app'), getStoredAppIcon('cached-app')])).resolves.toEqual([
    url,
    url
  ])
  await expect(getStoredAppIcon('cached-app')).resolves.toBe(url)

  expect(readFile).toHaveBeenCalledOnce()
})

it('invalidates cached metadata after adding and removing an icon', async () => {
  const appId = 'edited-app'
  const url = `/api/app-icons/${appId}`
  vi.mocked(readFile)
    .mockRejectedValueOnce(new Error('Missing icon'))
    .mockResolvedValueOnce(JSON.stringify({ icon: url }))
    .mockRejectedValueOnce(new Error('Missing icon'))
  vi.mocked(unlink).mockResolvedValue(undefined)

  await expect(getStoredAppIcon(appId)).resolves.toBeNull()
  await setStoredAppIcon(appId, 'data:image/png;base64,AA==')
  await expect(getStoredAppIcon(appId)).resolves.toBe(url)
  await removeStoredAppIcon(appId)
  await expect(getStoredAppIcon(appId)).resolves.toBeNull()

  expect(readFile).toHaveBeenCalledTimes(3)
})
