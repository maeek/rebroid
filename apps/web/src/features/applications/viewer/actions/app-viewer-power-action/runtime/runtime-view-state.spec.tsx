import { describe, expect, it } from 'vitest'
import { createRuntimeMenuActions } from './runtime-menu-actions'
import {
  canRecreateRuntime,
  canRestartRuntime,
  canStartDefaults,
  canStartProfile,
  canStopRuntime,
  getCanRestart
} from './runtime-view-state'
import type { AppDefinition } from '@/features/applications/domain/app-definition'

const app = (running: boolean): AppDefinition =>
  ({
    id: 'app-1',
    name: 'App',
    running,
    status: running ? 'running' : 'stopped'
  }) as AppDefinition

describe('runtime power action state helpers', () => {
  it('enables restart only when both start and stop are allowed', () => {
    expect(getCanRestart(true, true)).toBe(true)
    expect(getCanRestart(true, false)).toBe(false)
  })

  it('enables start actions only for stopped apps with permission', () => {
    expect(canStartDefaults(app(false), true)).toBe(true)
    expect(canStartDefaults(app(true), true)).toBe(false)
    expect(canStartProfile(app(false), true, true)).toBe(true)
    expect(canStartProfile(app(false), true, false)).toBe(false)
  })

  it('enables stop and restart only for running apps with permission', () => {
    expect(canStopRuntime(app(true), true)).toBe(true)
    expect(canStopRuntime(app(false), true)).toBe(false)
    expect(canRestartRuntime(app(true), true)).toBe(true)
    expect(canRestartRuntime(app(false), true)).toBe(false)
  })

  it('marks runtime menu actions from app state and permissions', () => {
    const actions = createRuntimeMenuActions({
      app: app(false),
      canStart: true,
      canSwitchProfile: false,
      canStop: true,
      canRestart: true,
      onStartDefaults: () => undefined,
      onStartProfile: () => undefined,
      onStop: () => undefined,
      onRestart: () => undefined,
      onRecreate: () => undefined
    })

    expect(actions.map(action => [action.key, action.disabled])).toEqual([
      ['start-defaults', false],
      ['start-profile', true],
      ['stop', true],
      ['restart', true],
      ['recreate', false]
    ])
  })

  it('offers recreation only for stopped or errored apps with power control', () => {
    expect(canRecreateRuntime(app(true), true)).toBe(false)
    expect(canRecreateRuntime(app(false), false)).toBe(false)
    expect(canRecreateRuntime({ ...app(false), lifecycleStage: 'stopping' }, true)).toBe(false)
    expect(canRecreateRuntime({ ...app(false), status: 'error' }, true)).toBe(true)
  })
})
