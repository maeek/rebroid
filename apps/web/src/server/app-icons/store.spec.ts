import { mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  cloneStoredAppIcon,
  getStoredAppIcon,
  getStoredAppIconFile,
  removeStoredAppIcon,
  setInitialStoredAppIcon,
  setStoredAppIcon
} from './store'

vi.mock('node:fs/promises', async importOriginal => {
  const fs = await importOriginal<typeof import('node:fs/promises')>()
  return { ...fs, rename: vi.fn(fs.rename) }
})

let storage: string
beforeEach(async () => {
  storage = await mkdtemp(join(tmpdir(), 'rebroid-app-icons-'))
  vi.stubEnv('WEB_APP_ICONS_PATH', storage)
})

afterEach(async () => {
  vi.unstubAllEnvs()
  await rm(storage, { recursive: true, force: true })
})

it('reads the published icon after upload and replacement and sees removal', async () => {
  const appId = 'edited-app'
  await expect(getStoredAppIcon(appId)).resolves.toBeNull()
  const first = await setStoredAppIcon(appId, 'data:image/png;base64,AA==')
  await expect(getStoredAppIcon(appId)).resolves.toBe(first)

  const second = await setStoredAppIcon(appId, 'data:image/png;base64,AQ==')
  expect(second).toMatch(/^\/api\/app-icons\/edited-app\?v=/)
  expect(second).not.toBe(first)
  await expect(getStoredAppIcon(appId)).resolves.toBe(second)
  const file = await getStoredAppIconFile(appId)
  await expect(readFile(file!.path)).resolves.toEqual(Buffer.from([1]))
  await expect(readdir(storage)).resolves.toHaveLength(2)

  await removeStoredAppIcon(appId)
  await expect(getStoredAppIcon(appId)).resolves.toBeNull()
  await expect(getStoredAppIconFile(appId)).resolves.toBeNull()
  await expect(readdir(storage)).resolves.toEqual([])
})

it('reads a removed icon as absent after a write from another server bundle', async () => {
  const appId = 'cross-bundle-removal'
  const url = await setStoredAppIcon(appId, 'data:image/png;base64,AA==')
  await expect(getStoredAppIcon(appId)).resolves.toBe(url)

  vi.resetModules()
  const writer = await import('./store')
  expect(writer.getStoredAppIcon).not.toBe(getStoredAppIcon)
  await writer.removeStoredAppIcon(appId)

  await expect(getStoredAppIconFile(appId)).resolves.toBeNull()
  await expect(getStoredAppIcon(appId)).resolves.toBeNull()
})

it('does not publish an icon whose metadata points to a missing image', async () => {
  const appId = 'missing-image'
  const url = `/api/app-icons/${appId}`
  await writeFile(
    join(storage, `${appId}.json`),
    JSON.stringify({ icon: url, fileName: `${appId}.png`, mimeType: 'image/png' })
  )

  await expect(getStoredAppIcon(appId)).resolves.toBeNull()
})

it('keeps the previous image readable if publication fails', async () => {
  const appId = 'failed-replacement'
  const first = await setStoredAppIcon(appId, 'data:image/png;base64,AA==')
  vi.mocked(rename).mockRejectedValueOnce(new Error('Could not publish metadata'))
  await expect(setStoredAppIcon(appId, 'data:image/png;base64,AQ==')).rejects.toThrow('Could not publish metadata')
  await expect(getStoredAppIcon(appId)).resolves.toBe(first)
  const file = await getStoredAppIconFile(appId)
  await expect(readFile(file!.path)).resolves.toEqual(Buffer.from([0]))
  await expect(readdir(storage)).resolves.toHaveLength(2)
})

it('reads and clones icons saved before versioned URLs', async () => {
  const appId = 'legacy-app'
  const url = `/api/app-icons/${appId}`
  await writeFile(
    join(storage, `${appId}.json`),
    JSON.stringify({ icon: url, fileName: `${appId}.png`, mimeType: 'image/png' })
  )
  await writeFile(join(storage, `${appId}.png`), Buffer.from([1]))

  await expect(getStoredAppIcon(appId)).resolves.toBe(url)
  const cloned = await cloneStoredAppIcon(appId, 'cloned-app')
  expect(cloned).toMatch(/^\/api\/app-icons\/cloned-app\?v=/)
  const file = await getStoredAppIconFile('cloned-app')
  await expect(readFile(file!.path)).resolves.toEqual(Buffer.from([1]))
})

it('serializes removal and replacement for the same app', async () => {
  const appId = 'concurrent-app'
  await setStoredAppIcon(appId, 'data:image/png;base64,AA==')
  const [, latest] = await Promise.all([
    removeStoredAppIcon(appId),
    setStoredAppIcon(appId, 'data:image/png;base64,AQ==')
  ])
  await expect(getStoredAppIcon(appId)).resolves.toBe(latest)
  await expect(readdir(storage)).resolves.toHaveLength(2)
})

it('publishes a creation icon once and leaves an existing icon intact', async () => {
  const appId = 'new-app'
  const first = await setInitialStoredAppIcon(appId, 'data:image/png;base64,AA==')
  expect(first).toMatch(/^\/api\/app-icons\/new-app\?v=/)

  vi.resetModules()
  const writer = await import('./store')
  await expect(writer.setInitialStoredAppIcon(appId, 'data:image/png;base64,AQ==')).resolves.toBeNull()
  await expect(getStoredAppIcon(appId)).resolves.toBe(first)
  await expect(readdir(storage)).resolves.toHaveLength(2)
})
