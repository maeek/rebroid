import { describe, expect, it } from 'vitest'
import { createRuntimeMenuActions } from './runtime-menu-actions'
import { getPowerActionViewState } from './runtime-view-state'
import type { AppDefinition } from '@/features/applications/domain/app-definition'

const makeApp = (running: boolean): AppDefinition =>
  ({
    id: 'app-1',
    name: 'App',
    running,
    status: running ? 'running' : 'stopped'
  }) as AppDefinition

const menu = (app: AppDefinition | undefined, canStart: boolean, canStop: boolean, canSwitchProfile = false) =>
  createRuntimeMenuActions({
    app,
    canStart,
    canStop,
    canSwitchProfile,
    onStartDefaults: () => undefined,
    onStartProfile: () => undefined,
    onStop: () => undefined,
    onRestart: () => undefined,
    onRecreate: () => undefined
  }).map(action => [action.key, action.disabled])

describe('runtime power controls', () => {
  it('offers actions by permission and enables them for the current runtime', () => {
    expect(menu(makeApp(false), true, false, true)).toEqual([
      ['start-defaults', false],
      ['start-profile', false]
    ])
    expect(menu(makeApp(true), true, false, true)).toEqual([
      ['start-defaults', true],
      ['start-profile', true]
    ])
    expect(menu(makeApp(true), false, true)).toEqual([['stop', false]])
    expect(menu(makeApp(false), true, true)).toEqual([
      ['start-defaults', false],
      ['stop', true],
      ['restart', true],
      ['recreate', false]
    ])
    expect(menu(makeApp(true), true, true)).toEqual([
      ['start-defaults', true],
      ['stop', false],
      ['restart', false],
      ['recreate', true]
    ])
    expect(menu(undefined, true, true).every(([, disabled]) => disabled)).toBe(true)
  })

  it('offers recreation for stopped and errored apps after stopping completes', () => {
    expect(menu({ ...makeApp(false), lifecycleStage: 'stopping' }, true, true)).toContainEqual(['recreate', true])
    expect(menu({ ...makeApp(false), status: 'error' }, true, true)).toContainEqual(['recreate', false])
  })

  it('keeps the pending operation label while the stored runtime is stopping', () => {
    expect(
      getPowerActionViewState({
        app: { ...makeApp(true), lifecycleStage: 'stopping' },
        actionPhase: 'restarting',
        isRunningAction: true,
        canStart: true,
        canStop: true
      })
    ).toEqual({
      canRunPrimary: true,
      dialogDisabled: true,
      isBusy: true,
      menuDisabled: true,
      primaryLabel: 'Restarting...',
      primaryVariant: 'secondary'
    })
  })
})
