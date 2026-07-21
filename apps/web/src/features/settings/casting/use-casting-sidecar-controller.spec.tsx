import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from '@/hooks/use-toast'
import {
  getOrchestratorHealthAction,
  listDisplaySidecarSessionsAction,
  releaseDisplaySidecarSessionAction,
  repairDisplaySidecarAction
} from '@/server/orchestrator/diagnostics/actions'
import { useCastingSidecarController } from './use-casting-sidecar-controller'
import type { DisplaySidecarSession, ServiceHealth } from '@/shared/contracts/diagnostics'

vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }))
vi.mock('@/server/orchestrator/diagnostics/actions', () => ({
  getOrchestratorHealthAction: vi.fn(),
  listDisplaySidecarSessionsAction: vi.fn(),
  releaseDisplaySidecarSessionAction: vi.fn(),
  repairDisplaySidecarAction: vi.fn()
}))

const healthy = { ok: true, message: 'ready' } as ServiceHealth
const session = (id: string, status: DisplaySidecarSession['status'] = 'active'): DisplaySidecarSession => ({
  id,
  applicationId: 'app-1',
  ownerUserId: 'owner-1',
  status,
  createdAt: '2026-01-01T00:00:00.000Z',
  lastActivityAt: '2026-01-02T00:00:00.000Z',
  expiresAt: '2026-01-03T00:00:00.000Z',
  capabilities: []
})

const renderController = (refreshKey = 0, onRefreshComplete = vi.fn()) =>
  renderHook(
    ({ key }) =>
      useCastingSidecarController({
        initialHealth: healthy,
        initialSessions: [session('initial')],
        applications: [],
        refreshKey: key,
        onRefreshComplete
      }),
    { initialProps: { key: refreshKey } }
  )

describe('useCastingSidecarController', () => {
  beforeEach(() => vi.clearAllMocks())

  it('refreshes health and sessions when the page requests it', async () => {
    vi.mocked(getOrchestratorHealthAction).mockResolvedValue({ services: { display: healthy } } as never)
    vi.mocked(listDisplaySidecarSessionsAction).mockResolvedValue([session('fresh')])
    const onRefreshComplete = vi.fn()
    const { result, rerender } = renderController(0, onRefreshComplete)

    rerender({ key: 1 })

    await waitFor(() => expect(result.current.sessions[0]?.id).toBe('fresh'))
    expect(result.current.busy).toBeNull()
    expect(onRefreshComplete).toHaveBeenCalled()
  })

  it('restarts the sidecar and then refreshes operational state', async () => {
    vi.mocked(repairDisplaySidecarAction).mockResolvedValue(healthy)
    vi.mocked(getOrchestratorHealthAction).mockResolvedValue({ services: { display: healthy } } as never)
    vi.mocked(listDisplaySidecarSessionsAction).mockResolvedValue([session('after-restart')])
    const { result } = renderController()

    await act(() => result.current.restartSidecar())

    expect(repairDisplaySidecarAction).toHaveBeenCalled()
    expect(result.current.sessions[0]?.id).toBe('after-restart')
    expect(toast).toHaveBeenCalledWith({ title: 'Casting sidecar restarted' })
  })

  it('ends active selections and preserves the returned terminal state', async () => {
    vi.mocked(releaseDisplaySidecarSessionAction).mockResolvedValue(session('initial', 'released'))
    const { result } = renderController()
    act(() => {
      result.current.setSelectedIds(new Set(['initial']))
      result.current.setPendingEndSessions([session('initial')])
    })

    await act(() => result.current.endSessions())

    expect(result.current.sessions[0]?.status).toBe('released')
    expect(result.current.selectedIds.size).toBe(0)
    expect(result.current.pendingEndSessions).toEqual([])
  })

  it('reports refresh errors without replacing the existing state', async () => {
    vi.mocked(getOrchestratorHealthAction).mockRejectedValue(new Error('display sidecar failed'))
    const { result, rerender } = renderController()

    rerender({ key: 1 })

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Could not load casting sessions', variant: 'danger' })
      )
    )
    expect(result.current.sessions[0]?.id).toBe('initial')
  })
})
