import { describe, expect, it } from 'vitest'
import { sanitizeApplicationLogForUser, sanitizeScrcpySessionForUser } from './safety'
import type { ScrcpySession } from './types'

const userContext = {
  role: 'user' as const,
  permissions: {},
  quotas: {
    maxOpenApps: 1,
    maxSessionSeconds: 1,
    maxMemoryMb: 1,
    maxCpuCpus: 1
  }
}

const session: ScrcpySession = {
  applicationId: 'app-1',
  transport: 'websocket',
  udid: '172.18.0.2:5555',
  proxyRemote: 'tcp:8886',
  player: 'webcodecs',
  viewerServiceConfigured: true,
  viewerTargetConnected: false,
  viewerMessage: 'Could not reach 172.18.0.2.',
  viewerError: {
    code: 'adb_unreachable',
    message: 'ADB failed for 172.18.0.2.',
    retryable: true,
    exitCode: null,
    command: ['adb', 'connect', '172.18.0.2:5555'],
    stdout: 'unable to reach 172.18.0.2',
    stderr: null
  },
  adbHost: '172.18.0.2',
  adbPort: 5555,
  displaySession: {
    id: 'display-1',
    surfaceId: 'main',
    surfaceKind: 'main',
    displayName: 'Main display',
    status: 'created',
    createdAt: '2026-01-01T00:00:00.000Z',
    lastActivityAt: '2026-01-01T00:00:00.000Z',
    expiresAt: '2026-01-01T00:01:00.000Z',
    maxExpiresAt: '2026-01-01T01:00:00.000Z',
    capabilities: [],
    surface: {
      id: 'main',
      sessionId: 'display-1',
      kind: 'main',
      name: 'Main display',
      status: 'created',
      createdAt: '2026-01-01T00:00:00.000Z',
      lastActivityAt: '2026-01-01T00:00:00.000Z',
      streamPath: '/stream',
      viewerPath: '/viewer',
      webrtcOfferPath: '/offer'
    },
    surfaces: [
      {
        id: 'main',
        sessionId: 'display-1',
        kind: 'main',
        name: 'Main display',
        status: 'created',
        createdAt: '2026-01-01T00:00:00.000Z',
        lastActivityAt: '2026-01-01T00:00:00.000Z',
        streamPath: '/stream',
        viewerPath: '/viewer',
        webrtcOfferPath: '/offer'
      }
    ],
    streamPath: '/stream',
    viewerPath: '/viewer',
    webrtcOfferPath: '/offer'
  }
}

describe('application safety redaction', () => {
  it('removes backend addresses from ordinary-user viewer sessions', () => {
    expect(JSON.stringify(sanitizeScrcpySessionForUser(session, userContext))).not.toContain('172.18.0.2')
  })

  it('removes backend addresses from ordinary-user logs', () => {
    expect(
      sanitizeApplicationLogForUser(
        {
          source: 'orchestrator',
          collectedAt: '2026-01-01T00:00:00.000Z',
          output: 'ADB target 172.18.0.2:5555'
        },
        userContext
      ).output
    ).toBe('ADB target [redacted address]:5555')
  })
})
