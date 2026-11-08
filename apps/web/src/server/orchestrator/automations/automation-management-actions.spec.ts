import { describe, expect, it, vi } from 'vitest'
import { updateAutomationAction } from './automation-management-actions'
import { orchestratorAutomationsClient } from './client'
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/server/orchestrator/current-user', () => ({
  getCurrentUserContext: () => Promise.resolve({ ownerUserId: 'actor' })
}))
vi.mock('./action-helpers', () => ({
  assertAutomationPermission: vi.fn(),
  assertDefinitionPermissions: vi.fn(),
  recordAutomationAudit: vi.fn()
}))
vi.mock('./client', () => ({ orchestratorAutomationsClient: { update: vi.fn() } }))
describe('workflow update input', () => {
  it('rejects alternate definitions before forwarding to the backend', async () => {
    await expect(
      updateAutomationAction('workflow', { definition: { spec: { steps: [{ uses: 'android.adbShell' }] } } } as never)
    ).rejects.toThrow()
    expect(orchestratorAutomationsClient.update).not.toHaveBeenCalled()
  })
})
