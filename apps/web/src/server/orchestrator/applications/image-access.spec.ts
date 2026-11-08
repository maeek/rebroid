import { describe, expect, it } from 'vitest'
import { isTrustedRedroidImage } from './image-access'
describe('Redroid image authorization', () => {
  it.each(['attacker/redroid', 'attacker/redroid-payload', 'evil.example/redroid/redroid', 'redroid/redroid-payload'])(
    'rejects publisher spoofing: %s',
    image => expect(isTrustedRedroidImage(image)).toBe(false)
  )
  it.each(['redroid/redroid:14', 'docker.io/redroid/redroid:14', 'redroid/redroid@sha256:abc'])(
    'recognizes the trusted repository: %s',
    image => expect(isTrustedRedroidImage(image)).toBe(true)
  )
})
