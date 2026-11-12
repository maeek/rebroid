import { expect, it, vi } from 'vitest'
import { GET } from '@/app/api/bff/platform/ai-provider-billing-issues/route'
import { requireAdmin } from '@/server/auth/authorization'
import { PublicActionError } from '@/server/errors/public-action-error'
import { emptyRequest } from '@/server/orchestrator/request'

vi.mock('@/server/auth/authorization', () => ({ requireAdmin: vi.fn() }))
vi.mock('@/server/observability/request-id', () => ({ getRequestId: () => 'billing-request' }))
vi.mock('@/server/observability/logger', () => ({ logger: { error: vi.fn() } }))
vi.mock('@/server/orchestrator/request', async importOriginal => ({
  ...(await importOriginal<typeof import('@/server/orchestrator/request')>()),
  emptyRequest: vi.fn()
}))

const incomingRequest = () => new Request('https://rebroid.test/api/bff/platform/ai-provider-billing-issues')

it('requires an admin session before reading the cached provider status', async () => {
  vi.mocked(requireAdmin).mockRejectedValue(new PublicActionError('Forbidden', { code: 'forbidden', status: 403 }))
  const response = await GET(incomingRequest())
  expect(response.status).toBe(403)
  expect(await response.json()).toMatchObject({ ok: false, error: { code: 'forbidden', requestId: 'billing-request' } })
  expect(emptyRequest).not.toHaveBeenCalled()
})

it('reads only from the orchestrator settings endpoint and returns only validated billing issues', async () => {
  vi.mocked(requireAdmin).mockResolvedValue({ isPlatformAdmin: true } as Awaited<ReturnType<typeof requireAdmin>>)
  const issue = { code: 'credit_balance_exhausted', observedAt: '2026-11-12T12:00:00.000Z' }
  vi.mocked(emptyRequest).mockResolvedValue([
    { id: 'openai', apiKey: 'masked', billingIssue: { ...issue, upstreamDetail: 'Private upstream detail' } },
    { id: 'local' }
  ])
  const request = incomingRequest()
  const response = await GET(request)
  expect(emptyRequest).toHaveBeenCalledExactlyOnceWith('/settings/ai-providers', { signal: request.signal })
  expect(response.headers.get('cache-control')).toBe('no-store')
  expect(await response.json()).toEqual({
    ok: true,
    data: [{ providerId: 'openai', issue }],
    requestId: 'billing-request'
  })
})
