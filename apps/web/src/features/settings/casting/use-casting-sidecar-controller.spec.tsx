import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from '@/hooks/use-toast'
import {
  getDisplaySidecarHealthAction,
  listDisplaySidecarSessionsAction,
  releaseDisplaySidecarSessionAction,
  repairDisplaySidecarAction
} from '@/server/orchestrator/diagnostics/actions'
import { actionError, actionOk } from '@/shared/actions/action-result'
import { useCastingSidecarController } from './use-casting-sidecar-controller'
import type { DisplaySidecarSession, ServiceHealth } from '@/shared/contracts/diagnostics'

vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }))
vi.mock('@/server/orchestrator/diagnostics/actions', () => ({
  getDisplaySidecarHealthAction: vi.fn(),
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
    vi.mocked(getDisplaySidecarHealthAction).mockResolvedValue(healthy)
    vi.mocked(listDisplaySidecarSessionsAction).mockResolvedValue([session('fresh')])
    const onRefreshComplete = vi.fn()
    const { result, rerender } = renderController(0, onRefreshComplete)

    rerender({ key: 1 })

    await waitFor(() => expect(result.current.sessions[0]?.id).toBe('fresh'))
    expect(result.current.busy).toBeNull()
    expect(onRefreshComplete).toHaveBeenCalled()
  })

  it('uses the restart response for health and refreshes sessions', async () => {
    vi.mocked(repairDisplaySidecarAction).mockResolvedValue(actionOk(healthy))
    vi.mocked(listDisplaySidecarSessionsAction).mockResolvedValue([session('after-restart')])
    const { result } = renderController()

    await act(() => result.current.restartSidecar())

    expect(repairDisplaySidecarAction).toHaveBeenCalled()
    expect(getDisplaySidecarHealthAction).not.toHaveBeenCalled()
    expect(result.current.sessions[0]?.id).toBe('after-restart')
    expect(toast).toHaveBeenCalledWith({ title: 'Casting sidecar restarted', variant: 'success' })
  })

  it('refreshes sidecar health when a restart times out and reports the outcome as unconfirmed', async () => {
    vi.mocked(repairDisplaySidecarAction).mockResolvedValue(
      actionError({ code: 'upstream_unavailable', status: 504, message: 'Timed out' }, 'restart-request')
    )
    const recovered = { ...healthy, message: 'Sidecar is responding' }
    vi.mocked(getDisplaySidecarHealthAction).mockResolvedValue(recovered)
    vi.mocked(listDisplaySidecarSessionsAction).mockResolvedValue([])
    const { result } = renderController()

    await act(() => result.current.restartSidecar())

    expect(repairDisplaySidecarAction).toHaveBeenCalledOnce()
    expect(result.current.health).toEqual(recovered)
    expect(toast).toHaveBeenCalledExactlyOnceWith({
      title: 'Casting sidecar restart unconfirmed',
      description:
        'The restart may still be in progress. Check the sidecar status before retrying. Request ID restart-request.',
      variant: 'warning'
    })
  })

  it('reports a session refresh error separately from a successful restart', async () => {
    vi.mocked(repairDisplaySidecarAction).mockResolvedValue(actionOk(healthy))
    vi.mocked(listDisplaySidecarSessionsAction).mockRejectedValue(new Error('Sessions unavailable'))
    const { result } = renderController()

    await act(() => result.current.restartSidecar())

    expect(result.current.health.ok).toBe(true)
    expect(toast).toHaveBeenNthCalledWith(1, { title: 'Casting sidecar restarted', variant: 'success' })
    expect(toast).toHaveBeenNthCalledWith(2, expect.objectContaining({ title: 'Could not load casting sessions' }))
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
    vi.mocked(getDisplaySidecarHealthAction).mockRejectedValue(new Error('display sidecar failed'))
    const { result, rerender } = renderController()

    rerender({ key: 1 })

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Could not load casting sessions', variant: 'danger' })
      )
    )
    expect(result.current.sessions[0]?.id).toBe('initial')
  })

  it('retains previous sessions without querying or mutating an offline display service', async () => {
    vi.mocked(getDisplaySidecarHealthAction).mockResolvedValue({
      ok: false,
      status: 'offline',
      message: 'Display unavailable'
    })
    const { result, rerender } = renderController()
    act(() => result.current.setPendingEndSessions([session('initial')]))
    rerender({ key: 1 })
    await waitFor(() => expect(result.current.health.ok).toBe(false))
    expect(result.current.sessions[0]?.id).toBe('initial')
    expect(listDisplaySidecarSessionsAction).not.toHaveBeenCalled()
    await act(() => result.current.endSessions())
    expect(releaseDisplaySidecarSessionAction).not.toHaveBeenCalled()
    expect(getDisplaySidecarHealthAction).toHaveBeenCalledOnce()
  })
})
