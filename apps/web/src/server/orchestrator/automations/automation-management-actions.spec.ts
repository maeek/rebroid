import { describe, expect, it, vi } from 'vitest'
import { POST as validateWorkflow } from '@/app/api/bff/automations/validate-yaml/route'
import { saveAutomationAction } from './automation-management-actions'
import { orchestratorAutomationsClient } from './client'
vi.mock('next/headers', () => ({ headers: () => Promise.resolve(new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('./action-helpers', async importOriginal => ({
  ...(await importOriginal<typeof import('./action-helpers')>()),
  requireAutomationUser: () => Promise.resolve({ ownerUserId: 'actor', permissions: {} }),
  recordAutomationAudit: vi.fn()
}))
vi.mock('./client', () => ({
  orchestratorAutomationsClient: { update: vi.fn(), listCommands: vi.fn(), validateYaml: vi.fn() }
}))
describe('workflow update input', () => {
  it('checks command permissions for both YAML preview and persistence', async () => {
    vi.mocked(orchestratorAutomationsClient.validateYaml).mockResolvedValue({
      valid: true,
      definition: { spec: { steps: [{ uses: 'android.wait', with: {} }] } }
    } as never)
    vi.mocked(orchestratorAutomationsClient.listCommands).mockResolvedValue([
      { uses: 'android.wait', requiredPermissions: ['automations:run'] }
    ] as never)
    const input = { yaml: 'example' }
    const preview = await validateWorkflow(
      new Request('https://example.test', {
        method: 'POST',
        body: JSON.stringify(input)
      })
    )
    expect(preview.status).toBe(403)
    await expect(saveAutomationAction('workflow', input)).resolves.toMatchObject({
      ok: false,
      error: { code: 'forbidden' }
    })
    expect(orchestratorAutomationsClient.update).not.toHaveBeenCalled()
  })
  it('rejects alternate definitions before forwarding to the backend', async () => {
    await expect(
      saveAutomationAction('workflow', { definition: { spec: { steps: [{ uses: 'android.adbShell' }] } } } as never)
    ).resolves.toMatchObject({ ok: false })
    expect(orchestratorAutomationsClient.update).not.toHaveBeenCalled()
  })
})
