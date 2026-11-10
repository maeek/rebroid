import { expect, it } from 'vitest'
import { DisplaySessionRecovery } from './display-session-recovery'

it('allows one authorized refresh until a replacement session presents video', () => {
  const recovery = new DisplaySessionRecovery()
  const original = { id: 'main', sessionId: 'original' }
  const replacement = { id: 'main', sessionId: 'replacement' }
  const virtual = { id: 'virtual', sessionId: 'virtual' }

  expect(recovery.request('app', original, [original, virtual])).toBe(true)
  expect(recovery.request('app', virtual, [original, virtual])).toBe(false)
  recovery.presented('app', original)
  expect(recovery.request('app', replacement, [replacement, virtual])).toBe(false)
  recovery.presented('app', replacement)
  expect(recovery.request('app', replacement, [replacement, virtual])).toBe(true)
})
