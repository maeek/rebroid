import { describe, expect, it } from '@jest/globals'
import { castingErrorMessage, filterSessions, sortSessions } from './casting-sidecar-utils'
import type { DisplaySidecarSession } from '@/server/orchestrator/diagnostics/types'

const sessions: DisplaySidecarSession[] = [
  {
    id: 'session-b',
    applicationId: 'app-b',
    ownerUserId: 'owner-b',
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    lastActivityAt: '2026-01-02T00:00:00.000Z',
    expiresAt: '2026-01-03T00:00:00.000Z',
    capabilities: []
  },
  {
    id: 'session-a',
    applicationId: 'app-a',
    ownerUserId: 'owner-a',
    status: 'released',
    createdAt: '2026-01-01T00:00:00.000Z',
    lastActivityAt: '2026-01-01T00:00:00.000Z',
    expiresAt: '2026-01-04T00:00:00.000Z',
    capabilities: []
  }
]

describe('casting sidecar utils', () => {
  it('casts display sidecar errors to casting language', () => {
    expect(castingErrorMessage(new Error('display sidecar failed'))).toBe('casting sidecar failed')
  })

  it('filters sessions by related app name', () => {
    const appsById = new Map([
      ['app-a', { id: 'app-a', name: 'Calculator' }],
      ['app-b', { id: 'app-b', name: 'Browser' }]
    ])

    expect(filterSessions(sessions, appsById, 'calc')).toEqual([sessions[1]])
  })

  it('sorts sessions by requested fields', () => {
    expect(sortSessions(sessions, [{ id: 'expiresAt', desc: false }]).map(session => session.id)).toEqual([
      'session-b',
      'session-a'
    ])
  })
})
