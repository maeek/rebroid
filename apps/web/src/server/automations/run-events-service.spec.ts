import { expect, it, vi } from 'vitest'
import { POST as cancel } from '@/app/api/bff/automations/runs/[runId]/cancel/route'
import { GET as history, POST as subscribe } from '@/app/api/bff/automations/runs/[runId]/events/route'
import { getCurrentUser } from '@/server/auth/authorization'
import { PublicActionError } from '@/server/errors/public-action-error'
import { emptyRequest, jsonRequest } from '@/server/orchestrator/request'

vi.mock('next/headers', () => ({ headers: () => new Headers({ origin: 'https://example.test' }) }))
vi.mock('@/server/auth/authorization', () => ({ getCurrentUser: vi.fn() }))
vi.mock('@/server/observability/request-id', () => ({ getRequestId: () => Promise.resolve('request-id') }))
vi.mock('@/server/orchestrator/request', async importOriginal => ({
  ...(await importOriginal<typeof import('@/server/orchestrator/request')>()),
  emptyRequest: vi.fn(),
  jsonRequest: vi.fn()
}))

const request = new Request('https://example.test/api/bff/automations/runs/run/events?after=2')
const context = { params: Promise.resolve({ runId: 'run' }) }

it('returns a validation error for a blank run selector', async () => {
  const response = await history(request, { params: Promise.resolve({ runId: '  ' }) })
  expect(response.status).toBe(400)
  expect(getCurrentUser).not.toHaveBeenCalled()
  expect(emptyRequest).not.toHaveBeenCalled()
})

it.each([history, subscribe, cancel])('returns an API authentication failure before reading the run', async route => {
  vi.mocked(getCurrentUser).mockRejectedValue(
    new PublicActionError('Sign in', { code: 'unauthenticated', status: 401 })
  )
  const response = await route(request, context)
  expect(response.status).toBe(401)
  expect(getCurrentUser).toHaveBeenCalledWith('api')
  expect(emptyRequest).not.toHaveBeenCalled()
  expect(jsonRequest).not.toHaveBeenCalled()
})

it('forwards the caller signal through history reads and stream token requests', async () => {
  vi.mocked(getCurrentUser).mockResolvedValue({
    id: 'owner',
    effectivePermissions: { 'automations:run': true }
  } as Awaited<ReturnType<typeof getCurrentUser>>)
  vi.mocked(emptyRequest).mockResolvedValue({ events: [], nextAfter: null })
  vi.mocked(jsonRequest).mockResolvedValue({ token: 'token' })
  expect((await history(request, context)).status).toBe(200)
  expect(emptyRequest).toHaveBeenCalledWith('/automations/runs/run/events/page?ownerUserId=owner&after=2', {
    signal: request.signal
  })
  expect((await subscribe(request, context)).status).toBe(200)
  expect(jsonRequest).toHaveBeenCalledWith(
    '/automations/runs/run/events/token',
    'POST',
    { ownerUserId: 'owner' },
    {
      signal: request.signal
    }
  )
})
