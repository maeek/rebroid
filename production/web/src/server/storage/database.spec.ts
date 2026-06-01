import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals'
import { forgetStoredRecentApp, listStoredRecentApps, rememberStoredRecentApp } from '@/server/recent-apps/store'
import { getWebSettings, saveWebSettings } from '@/server/web-settings/store'
import { readWebState, resetWebDatabaseForTests, writeWebState } from './database'

describe('web state database', () => {
  let tempDirectory: string

  beforeEach(async () => {
    tempDirectory = await mkdtemp(join(tmpdir(), 'rebroid-web-state-'))
    process.env.WEB_DATABASE_PATH = join(tempDirectory, 'web.sqlite')
  })

  afterEach(async () => {
    delete process.env.WEB_DATABASE_PATH
    resetWebDatabaseForTests()
    await rm(tempDirectory, { recursive: true, force: true })
  })

  it('stores web settings transactionally', async () => {
    await Promise.all([
      saveWebSettings({ removeDataOnDelete: false }),
      saveWebSettings({ defaultViewerBitrateMbps: 8 })
    ])

    await expect(getWebSettings()).resolves.toMatchObject({
      removeDataOnDelete: false,
      defaultViewerBitrateMbps: 8
    })
  })

  it('preserves concurrent recent application updates', async () => {
    await Promise.all([
      rememberStoredRecentApp('user-1', 'app-1'),
      rememberStoredRecentApp('user-1', 'app-2'),
      rememberStoredRecentApp('user-1', 'app-3')
    ])
    await forgetStoredRecentApp('user-1', 'app-2')

    await expect(listStoredRecentApps('user-1')).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'app-1' }), expect.objectContaining({ id: 'app-3' })])
    )
  })

  it('does not hide corrupted state', async () => {
    writeWebState('web-settings', '{malformed')

    await expect(getWebSettings()).rejects.toThrow()
    expect(readWebState('web-settings')).toBe('{malformed')
  })
})
