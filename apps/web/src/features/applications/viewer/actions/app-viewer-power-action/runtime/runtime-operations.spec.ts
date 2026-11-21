import { afterEach, expect, it, vi } from 'vitest'
import { previewApp } from '@/features/applications/detail/app-resource-preview-data'
import { startAppRuntime } from './runtime-operations'

vi.mock('@/server/orchestrator/applications/actions/lifecycle/lifecycle-actions', () => ({
  requestApplicationStartAction: vi.fn(),
  requestApplicationStopAction: vi.fn()
}))

afterEach(() => vi.restoreAllMocks())

it('retains the accepted start when browser profile storage is unavailable', async () => {
  const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('Storage unavailable')
  })
  const start = (accepted: boolean) =>
    startAppRuntime({
      app: previewApp,
      options: { profileMode: 'persistent', profileName: ' Work ' },
      runAction: () => Promise.resolve(accepted),
      setActionPhase: vi.fn()
    })
  await expect(start(false)).resolves.toBe(false)
  expect(write).not.toHaveBeenCalled()
  await expect(start(true)).resolves.toBe(true)
  expect(write).toHaveBeenCalledExactlyOnceWith(
    `rebroid.app-profiles.${previewApp.id}`,
    '[{"mode":"persistent","name":"Work"}]'
  )
})
