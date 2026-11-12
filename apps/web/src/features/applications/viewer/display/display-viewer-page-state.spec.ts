import { expect, it, vi } from 'vitest'
import { PublicActionError } from '@/server/errors/public-action-error'
import { loadViewerPageApplication } from '@/server/orchestrator/applications/viewer-grant-access'
import { OrchestratorRequestError } from '@/server/orchestrator/request'
import { resolveDisplayViewerPageState } from './display-viewer-page-state'
import type { AndroidApplication } from '@/shared/contracts/application'

vi.mock('@/server/orchestrator/applications/viewer-grant-access', () => ({
  loadViewerPageApplication: vi.fn()
}))

const id = 'app'

const mockSessionError = (error: Error, startedAt: number, completedAt: number) => {
  const app = {
    id,
    status: {
      currentStatus: 'running',
      lifecycleStage: 'ready',
      lastStartedAt: new Date(startedAt).toISOString(),
      provisioningCompletedAt: new Date(completedAt).toISOString()
    },
    runtime: { image: 'redroid/redroid:14.0.0-latest' }
  } as AndroidApplication
  vi.mocked(loadViewerPageApplication).mockResolvedValue({
    app,
    openSession: vi.fn().mockRejectedValue(error)
  })
}

it('keeps a bounded retry window after Android took longer than 45 seconds to start', async () => {
  const now = Date.now()
  mockSessionError(new OrchestratorRequestError('Sidecar unavailable', 503), now - 90_000, now - 5_000)

  await expect(resolveDisplayViewerPageState({ id })).resolves.toMatchObject({
    kind: 'startup',
    deadlineAt: new Date(now + 40_000).toISOString()
  })
})

it('shows a terminal grant failure immediately after a long boot', async () => {
  const now = Date.now()
  mockSessionError(new PublicActionError('Forbidden', { code: 'forbidden', status: 403 }), now - 90_000, now)

  await expect(resolveDisplayViewerPageState({ id })).resolves.toMatchObject({ kind: 'splash', tone: 'danger' })
})

it('does not retry past the current runtime’s startup window', async () => {
  const now = Date.now()
  mockSessionError(new OrchestratorRequestError('Sidecar unavailable', 503), now - 180_000, now - 60_000)

  await expect(resolveDisplayViewerPageState({ id })).resolves.toMatchObject({ kind: 'splash', tone: 'danger' })
})
