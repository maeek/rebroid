import { describe, expect, it } from 'vitest'
import { emptyModel } from './provider-form-model'
import { defaultModelFor, normalizeModelDefaults, normalizeModelRoles } from './provider-model-usage'

describe('provider model purposes and defaults', () => {
  it('preserves the API rule that planning includes device control', () => {
    expect(normalizeModelRoles(['planner', 'vision'])).toEqual(['controller', 'planner', 'vision'])
  })

  it('previews the first enabled fallback when a default is disabled or removed', () => {
    const models = [
      { ...emptyModel(), id: 'disabled', enabled: false, defaultFor: ['planner' as const] },
      { ...emptyModel(), id: 'first' },
      { ...emptyModel(), id: 'second' },
      { ...emptyModel(), id: 'vision', roles: ['vision' as const], defaultFor: ['vision' as const] }
    ]
    const normalized = normalizeModelDefaults(models)
    expect(defaultModelFor(normalized, 'planner')?.id).toBe('first')
    expect(normalized.map(model => model.defaultFor)).toEqual([[], ['controller', 'planner'], [], ['vision']])
    expect(models[0].defaultFor).toEqual(['planner'])
    expect(
      defaultModelFor(normalizeModelDefaults(normalized.filter(model => model.id !== 'first')), 'planner')?.id
    ).toBe('second')
  })
})
