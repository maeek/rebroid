import { act, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { previewApp } from '@/features/applications/detail/app-resource-preview-data'
import { requestApplicationStartAction } from '@/server/orchestrator/applications/actions/lifecycle/lifecycle-actions'
import { actionOk } from '@/shared/actions/action-result'
import { usePowerActionRuntimeHandlers } from './runtime-actions'
import type { PowerActionRuntimeHandlersOptions } from '../types'

vi.mock('@/server/orchestrator/applications/actions/lifecycle/lifecycle-actions', () => ({
  requestApplicationStartAction: vi.fn(),
  requestApplicationStopAction: vi.fn()
}))

afterEach(() => vi.restoreAllMocks())

const options = (runAction: PowerActionRuntimeHandlersOptions['runAction']): PowerActionRuntimeHandlersOptions => ({
  app: previewApp,
  canSwitchProfile: true,
  profileMode: 'persistent',
  profileName: ' Work ',
  runAction,
  setStartDialogOpen: vi.fn(),
  setRestartDialogOpen: vi.fn(),
  setStopDialogOpen: vi.fn()
})

it('retains the accepted start when browser profile storage is unavailable', async () => {
  const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('Storage unavailable')
  })
  vi.mocked(requestApplicationStartAction).mockResolvedValueOnce(
    actionOk({ status: 'provisioning', lifecycleStage: 'queued', message: null })
  )
  const runAction = vi
    .fn<PowerActionRuntimeHandlersOptions['runAction']>()
    .mockResolvedValueOnce(false)
    .mockImplementationOnce(async action => {
      await action()
      return true
    })
  const props = options(runAction)
  const { result } = renderHook(() => usePowerActionRuntimeHandlers(props))
  await act(() => result.current.handleProfileStart())
  expect(props.setStartDialogOpen).not.toHaveBeenCalled()
  expect(write).not.toHaveBeenCalled()
  await act(() => result.current.handleProfileStart())
  expect(props.setStartDialogOpen).toHaveBeenCalledExactlyOnceWith(false)
  expect(requestApplicationStartAction).toHaveBeenCalledExactlyOnceWith(previewApp.id, {
    profileMode: 'persistent',
    profileName: 'Work'
  })
  expect(write).toHaveBeenCalledExactlyOnceWith(
    `rebroid.app-profiles.${previewApp.id}`,
    '[{"mode":"persistent","name":"Work"}]'
  )
})

it('keeps the pending phase through a second confirmation and releases it on failure', async () => {
  const pending = Promise.withResolvers<boolean>()
  const runAction = vi.fn().mockReturnValueOnce(pending.promise).mockResolvedValueOnce(true)
  const props = options(runAction)
  const { result } = renderHook(() => usePowerActionRuntimeHandlers(props))
  let stop!: Promise<void>
  act(() => {
    stop = result.current.handleStopConfirm()
    void result.current.handleRestart()
  })
  expect(runAction).toHaveBeenCalledTimes(1)
  expect(result.current.actionPhase).toBe('stopping')
  await act(async () => {
    pending.reject(new Error('aborted'))
    await expect(stop).rejects.toThrow('aborted')
  })
  expect(result.current.actionPhase).toBeNull()
  expect(props.setStopDialogOpen).not.toHaveBeenCalled()
  await act(() => result.current.handleRestart())
  expect(props.setRestartDialogOpen).toHaveBeenCalledExactlyOnceWith(false)
})
