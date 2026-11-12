import { beforeEach, describe, expect, it, vi } from 'vitest'
import { requireAdmin } from '@/server/auth/authorization'
import { getWebSettings } from '@/server/web-settings/store'
import { defaultWebSettingsResponse, pickGeneralUiSettings } from '@/shared/model/settings/orchestrator-ui-settings'
import { getConsoleDefaultsPageData } from './page-data.server'

vi.mock('@/server/auth/authorization', () => ({ requireAdmin: vi.fn() }))
vi.mock('@/server/web-settings/store', () => ({ getWebSettings: vi.fn() }))

describe('console defaults access', () => {
  beforeEach(() => vi.resetAllMocks())

  it('checks administrator access before reading shared defaults', async () => {
    vi.mocked(requireAdmin).mockRejectedValue(new Error('Access denied'))
    await expect(getConsoleDefaultsPageData()).rejects.toThrow('Access denied')
    expect(getWebSettings).not.toHaveBeenCalled()
  })

  it('loads saved console defaults and propagates read failures', async () => {
    vi.mocked(getWebSettings).mockResolvedValue(defaultWebSettingsResponse)
    expect(await getConsoleDefaultsPageData()).toEqual({
      initialSettings: pickGeneralUiSettings(defaultWebSettingsResponse)
    })
    expect(requireAdmin).toHaveBeenCalledOnce()
    vi.mocked(getWebSettings).mockRejectedValue(new Error('Settings unavailable'))
    await expect(getConsoleDefaultsPageData()).rejects.toThrow('Settings unavailable')
  })
})
