import { describe, expect, it } from 'vitest'
import { resolveManualImageReference } from './manual-image-reference'

describe('resolveManualImageReference', () => {
  it.each([
    ['docker-hub', ' alpine ', 'docker.io/alpine'],
    ['docker-hub', 'redroid/redroid:latest', 'docker.io/redroid/redroid:latest'],
    ['custom', 'registry.example:5000/team/image', 'registry.example:5000/team/image'],
    ['custom', 'localhost:5000/image:v1', 'localhost:5000/image:v1'],
    ['custom', `ghcr.io/team/image@sha256:${'a'.repeat(64)}`, `ghcr.io/team/image@sha256:${'a'.repeat(64)}`]
  ])('resolves %s image %s', (registry, draft, expected) => {
    expect(resolveManualImageReference(registry, draft)).toBe(expected)
  })

  it.each([
    ['docker-hub', 'ghcr.io/team/image'],
    ['docker-hub', 'alpine:'],
    ['custom', 'owner/image'],
    ['custom', 'https://ghcr.io/owner/image'],
    ['custom', 'user:token@registry.example/image'],
    ['custom', 'ghcr.io/team//image'],
    ['unknown', 'alpine']
  ])('rejects %s image %s', (registry, draft) => {
    expect(resolveManualImageReference(registry, draft)).toBeNull()
  })
})
