import { describe, expect, it } from 'vitest'
import { defaultViewerSettings } from '@/features/applications/viewer/settings/viewer-settings'
import { buildDisplayViewerSurfaces } from './display-viewer-surfaces'
import type { ScrcpySession } from '@/shared/contracts/application'

const createSession = (displaySession: NonNullable<ScrcpySession['displaySession']>): ScrcpySession => ({
  applicationId: 'app-1',
  transport: 'webrtc',
  udid: 'adb:5555',
  proxyRemote: 'tcp:8886',
  player: 'webcodecs',
  viewerServiceConfigured: true,
  viewerTargetConnected: true,
  viewerMessage: null,
  viewerError: null,
  adbHost: 'adb',
  adbPort: 5555,
  displaySession
})

describe('buildDisplayViewerSurfaces', () => {
  it('defaults viewer surfaces to video-only audio parameters', () => {
    const session = createSession({
      id: 'session-current',
      appId: 'app-1',
      surfaceId: 'main',
      surfaceKind: 'main',
      displayName: 'Main display',
      status: 'created',
      createdAt: '2026-06-06T10:00:00.000Z',
      lastActivityAt: '2026-06-06T10:00:00.000Z',
      expiresAt: '2026-06-06T10:05:00.000Z',
      maxExpiresAt: '2026-06-06T11:00:00.000Z',
      capabilities: ['video', 'control'],
      streamPath: '/rebroid/display/stream?sessionId=session-current',
      viewerPath: '/viewer/display?sessionId=session-current',
      webrtcOfferPath: '/rebroid/display/public/sessions/session-current/webrtc/offer',
      surface: {
        id: 'main',
        sessionId: 'session-current',
        kind: 'main',
        name: 'Main display',
        status: 'created',
        createdAt: '2026-06-06T10:00:00.000Z',
        lastActivityAt: '2026-06-06T10:00:00.000Z',
        streamPath: '/rebroid/display/stream?sessionId=session-current',
        viewerPath: '/viewer/display?sessionId=session-current',
        webrtcOfferPath: '/rebroid/display/public/sessions/session-current/webrtc/offer'
      },
      surfaces: [
        {
          id: 'main',
          sessionId: 'session-current',
          kind: 'main',
          name: 'Main display',
          status: 'created',
          createdAt: '2026-06-06T10:00:00.000Z',
          lastActivityAt: '2026-06-06T10:00:00.000Z',
          streamPath: '/rebroid/display/stream?sessionId=session-current',
          viewerPath: '/viewer/display?sessionId=session-current',
          webrtcOfferPath: '/rebroid/display/public/sessions/session-current/webrtc/offer'
        }
      ]
    })

    const surfaces = buildDisplayViewerSurfaces({
      session,
      baseUrl: 'https://display.test',
      soundEnabled: defaultViewerSettings.soundEnabled,
      settings: defaultViewerSettings,
      mainDisplaySize: { width: 1080, height: 1920 },
      controlsEnabled: true
    })

    expect(surfaces[0].src).toContain('audio=0')
  })

  it('requests audio when sound capture is enabled', () => {
    const session = createSession({
      id: 'session-current',
      appId: 'app-1',
      surfaceId: 'main',
      surfaceKind: 'main',
      displayName: 'Main display',
      status: 'created',
      createdAt: '2026-06-06T10:00:00.000Z',
      lastActivityAt: '2026-06-06T10:00:00.000Z',
      expiresAt: '2026-06-06T10:05:00.000Z',
      maxExpiresAt: '2026-06-06T11:00:00.000Z',
      capabilities: ['video', 'control'],
      streamPath: '/rebroid/display/stream?sessionId=session-current',
      viewerPath: '/viewer/display?sessionId=session-current',
      webrtcOfferPath: '/rebroid/display/public/sessions/session-current/webrtc/offer',
      surface: {
        id: 'main',
        sessionId: 'session-current',
        kind: 'main',
        name: 'Main display',
        status: 'created',
        createdAt: '2026-06-06T10:00:00.000Z',
        lastActivityAt: '2026-06-06T10:00:00.000Z',
        streamPath: '/rebroid/display/stream?sessionId=session-current',
        viewerPath: '/viewer/display?sessionId=session-current',
        webrtcOfferPath: '/rebroid/display/public/sessions/session-current/webrtc/offer'
      },
      surfaces: [
        {
          id: 'main',
          sessionId: 'session-current',
          kind: 'main',
          name: 'Main display',
          status: 'created',
          createdAt: '2026-06-06T10:00:00.000Z',
          lastActivityAt: '2026-06-06T10:00:00.000Z',
          streamPath: '/rebroid/display/stream?sessionId=session-current',
          viewerPath: '/viewer/display?sessionId=session-current',
          webrtcOfferPath: '/rebroid/display/public/sessions/session-current/webrtc/offer'
        }
      ]
    })

    const surfaces = buildDisplayViewerSurfaces({
      session,
      baseUrl: 'https://display.test',
      soundEnabled: true,
      settings: { ...defaultViewerSettings, soundEnabled: true },
      mainDisplaySize: { width: 1080, height: 1920 },
      controlsEnabled: true
    })

    expect(surfaces[0].src).toContain('audio=1')
  })

  it('collapses duplicate main surfaces from sibling sidecar sessions', () => {
    const session = createSession({
      id: 'session-current',
      appId: 'app-1',
      surfaceId: 'main',
      surfaceKind: 'main',
      displayName: 'Main display',
      status: 'created',
      createdAt: '2026-06-06T10:00:00.000Z',
      lastActivityAt: '2026-06-06T10:00:00.000Z',
      expiresAt: '2026-06-06T10:05:00.000Z',
      maxExpiresAt: '2026-06-06T11:00:00.000Z',
      capabilities: ['video', 'control'],
      streamPath: '/rebroid/display/stream?sessionId=session-current',
      viewerPath: '/viewer/display?sessionId=session-current',
      webrtcOfferPath: '/rebroid/display/public/sessions/session-current/webrtc/offer',
      surface: {
        id: 'main',
        sessionId: 'session-current',
        kind: 'main',
        name: 'Main display',
        status: 'created',
        createdAt: '2026-06-06T10:00:00.000Z',
        lastActivityAt: '2026-06-06T10:00:00.000Z',
        streamPath: '/rebroid/display/stream?sessionId=session-current',
        viewerPath: '/viewer/display?sessionId=session-current',
        webrtcOfferPath: '/rebroid/display/public/sessions/session-current/webrtc/offer'
      },
      surfaces: [
        {
          id: 'main',
          sessionId: 'session-older',
          kind: 'main',
          name: 'Main display',
          status: 'active',
          createdAt: '2026-06-06T09:59:00.000Z',
          lastActivityAt: '2026-06-06T10:00:00.000Z',
          streamPath: '/rebroid/display/stream?sessionId=session-older',
          viewerPath: '/viewer/display?sessionId=session-older',
          webrtcOfferPath: '/rebroid/display/public/sessions/session-older/webrtc/offer'
        },
        {
          id: 'main',
          sessionId: 'session-current',
          kind: 'main',
          name: 'Main display',
          status: 'created',
          createdAt: '2026-06-06T10:00:00.000Z',
          lastActivityAt: '2026-06-06T10:00:00.000Z',
          streamPath: '/rebroid/display/stream?sessionId=session-current',
          viewerPath: '/viewer/display?sessionId=session-current',
          webrtcOfferPath: '/rebroid/display/public/sessions/session-current/webrtc/offer'
        },
        {
          id: 'virtual-1',
          sessionId: 'session-virtual',
          kind: 'virtual',
          name: 'Virtual display',
          status: 'created',
          createdAt: '2026-06-06T10:01:00.000Z',
          lastActivityAt: '2026-06-06T10:01:00.000Z',
          streamPath: '/rebroid/display/stream?sessionId=session-virtual',
          viewerPath: '/viewer/display?sessionId=session-virtual',
          webrtcOfferPath: '/rebroid/display/public/sessions/session-virtual/webrtc/offer',
          newDisplay: { width: 1280, height: 720, dpi: 160 }
        }
      ]
    })

    const surfaces = buildDisplayViewerSurfaces({
      session,
      baseUrl: 'https://display.test',
      soundEnabled: true,
      settings: defaultViewerSettings,
      mainDisplaySize: { width: 1080, height: 1920 },
      controlsEnabled: true
    })

    expect(surfaces).toHaveLength(2)
    expect(surfaces.map(surface => surface.kind)).toEqual(['main', 'virtual'])
    expect(surfaces[0]).toMatchObject({
      id: 'main',
      sessionId: 'session-current',
      src: '/viewer/display?sessionId=session-current&player=webcodecs&transport=webrtc&audio=1&bitrate=16000000&maxFps=60&maxSize=0&iFrameInterval=1&fitToFrame=1'
    })
  })
})
