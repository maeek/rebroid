import { expect, it, vi } from 'vitest'
import { requireAdmin } from '@/server/auth/authorization'
import { orchestratorDiagnosticsClient } from '@/server/orchestrator/diagnostics/client'
import { readDockerMetrics } from './docker-diagnostics'

vi.mock('@/server/auth/authorization', () => ({ requireAdmin: vi.fn() }))
vi.mock('@/server/orchestrator/diagnostics/client', () => ({
  orchestratorDiagnosticsClient: { dockerMetrics: vi.fn() }
}))

it('rejects unauthorized metrics reads before contacting Docker diagnostics', async () => {
  vi.mocked(requireAdmin).mockRejectedValue(new Error('Forbidden'))
  await expect(readDockerMetrics()).rejects.toThrow('Forbidden')
  expect(orchestratorDiagnosticsClient.dockerMetrics).not.toHaveBeenCalled()
})

it('loads metrics for an authenticated administrator', async () => {
  await readDockerMetrics()
  expect(requireAdmin).toHaveBeenCalledTimes(1)
  expect(orchestratorDiagnosticsClient.dockerMetrics).toHaveBeenCalledTimes(1)
})
