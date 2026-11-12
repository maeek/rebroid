import { describe, expect, it, vi } from 'vitest'
import { requireAdmin } from '@/server/auth/authorization'
import { OrchestratorRequestError } from '@/server/orchestrator/request'
import { orchestratorPlatformClient } from './client'
import { loadServiceContainerIds, resolveServiceContainerIds } from './service-containers'
import type { OrchestratorHealth } from '@/shared/contracts/diagnostics'
import type { PlatformContainer } from '@/shared/contracts/platform'

vi.mock('next/navigation', () => ({ unstable_rethrow: vi.fn() }))
vi.mock('@/server/auth/authorization', () => ({ requireAdmin: vi.fn() }))
vi.mock('./client', () => ({ orchestratorPlatformClient: { listPlatformContainers: vi.fn() } }))

const container = (id: string, name: string, service: string, project = 'rebroid'): PlatformContainer => ({
  id,
  shortId: id.slice(0, 12),
  names: [name],
  image: '',
  imageId: '',
  command: '',
  createdAt: '2026-11-12T12:00:00.000Z',
  state: 'running',
  status: 'Up',
  labels: { 'com.docker.compose.project': project, 'com.docker.compose.service': service },
  managed: false,
  orphaned: false,
  applicationId: null,
  component: null,
  ports: [],
  networks: []
})

describe('service connection containers', () => {
  it('resolves Compose aliases and the managed firewall socket within the current deployment', () => {
    const containers = [
      container('web-container-id', 'rebroid-web', 'web'),
      container('other-orchestrator', 'other-orchestrator', 'orchestrator', 'other'),
      container('other-firewall', 'other-firewall', 'firewall-agent', 'other'),
      container('orchestrator-id', 'rebroid-orchestrator', 'orchestrator'),
      container('firewall-id', 'rebroid-firewall-agent', 'firewall-agent'),
      container('ocr-id', 'rebroid-ocr-sidecar', 'ocr-sidecar'),
      container('display-id', 'rebroid-display-sidecar', 'display-sidecar')
    ]
    expect(
      resolveServiceContainerIds(containers, {
        webHostname: containers[0].shortId,
        orchestratorEndpoint: 'http://orchestrator:4100',
        displayEndpoint: 'http://rebroid-display-sidecar:8000',
        settings: {
          firewall: { endpoint: '/run/rebroid-firewall/agent.sock', timeoutMs: 5000 },
          ocr: {
            endpoint: 'http://ocr-sidecar:8100',
            timeoutMs: 5000,
            language: 'en',
            maxImageDimension: 1600,
            minConfidence: 0.5
          }
        }
      })
    ).toEqual({ orchestrator: 'orchestrator-id', firewall: 'firewall-id', ocr: 'ocr-id', display: 'display-id' })
  })

  it('prefers the reported display container ID and omits unassociated connections', () => {
    const display = container('a1b2c3d4e5f6-display', 'custom-display', 'display-sidecar')
    const previous = container('previous-display', 'rebroid-display-sidecar', 'display-sidecar', 'other')

    expect(
      resolveServiceContainerIds([display, previous], {
        webHostname: 'standalone',
        orchestratorEndpoint: 'http://localhost:4100',
        displayEndpoint: 'http://rebroid-display-sidecar:8000',
        displayHealth: { ok: false, status: 'offline', message: 'Offline', details: { containerId: display.shortId } },
        settings: { firewall: { endpoint: '/tmp/rebroid-firewall/agent.sock', timeoutMs: 5000 } }
      })
    ).toEqual({ orchestrator: undefined, display: display.id, firewall: undefined, ocr: undefined })
  })

  it('keeps connection pages available when the optional Docker inventory read times out', async () => {
    const health = { services: { docker: { ok: true } } } as OrchestratorHealth
    vi.mocked(orchestratorPlatformClient.listPlatformContainers).mockRejectedValue(
      new OrchestratorRequestError('timeout', 504)
    )

    await expect(loadServiceContainerIds(health)).resolves.toEqual({})
    expect(requireAdmin).toHaveBeenCalledOnce()
    expect(orchestratorPlatformClient.listPlatformContainers).toHaveBeenCalledWith(expect.any(AbortSignal))
  })
})
