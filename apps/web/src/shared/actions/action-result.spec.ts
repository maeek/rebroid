import { describe, expect, it } from 'vitest'
import { actionError, actionOk, isActionResult, unwrapActionResult } from './action-result'

describe('action result helpers', () => {
  it('unwraps successful results', () => {
    expect(unwrapActionResult(actionOk({ id: 'item-1' }))).toEqual({ id: 'item-1' })
  })

  it('throws failed result messages', () => {
    expect(() => unwrapActionResult(actionError({ message: 'Specific failure.' }))).toThrow('Specific failure.')
  })

  it('detects serializable action results', () => {
    expect(isActionResult(actionOk(undefined))).toBe(true)
    expect(isActionResult(actionError({ message: 'Nope.' }))).toBe(true)
    expect(isActionResult({ ok: false, error: {} })).toBe(false)
    expect(isActionResult({ ok: true })).toBe(false)
  })
})
