import { expect, it, vi } from 'vitest'
import { GET } from '@/app/api/bff/platform/health/route'
import { requireAdmin } from '@/server/auth/authorization'
import { PublicActionError } from '@/server/errors/public-action-error'
import { orchestratorDiagnosticsClient } from '@/server/orchestrator/diagnostics/client'

vi.mock('@/server/auth/authorization', () => ({ requireAdmin: vi.fn() }))
vi.mock('@/server/orchestrator/diagnostics/client', () => ({
  orchestratorDiagnosticsClient: { healthSummary: vi.fn() }
}))

const request = () => new Request('https://rebroid.example/api/bff/platform/health')

it('requires current administrator access before querying health', async () => {
  vi.mocked(requireAdmin).mockRejectedValue(
    new PublicActionError('Administrator access is required.', {
      code: 'forbidden',
      status: 403
    })
  )
  const response = await GET(request())
  expect(response.status).toBe(403)
  expect(requireAdmin).toHaveBeenCalledWith('api')
  expect(orchestratorDiagnosticsClient.healthSummary).not.toHaveBeenCalled()
})

it('serves the health summary with the browser request signal', async () => {
  const read = request()
  await GET(read)
  expect(orchestratorDiagnosticsClient.healthSummary).toHaveBeenCalledWith(read.signal)
})
