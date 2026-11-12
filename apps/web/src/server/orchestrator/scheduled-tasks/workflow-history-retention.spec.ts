import { revalidatePath } from 'next/cache'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { recordAuditEvent } from '@/server/audit/events'
import { getCurrentUser, requireAdmin } from '@/server/auth/authorization'
import { workflowHistoryRetentionKey, type ScheduledTask } from '@/shared/contracts/scheduled-task'
import { saveWorkflowHistoryRetentionAction } from './actions'
import { orchestratorScheduledTasksClient } from './client'
import { loadWorkflowHistoryRetention } from './workflow-history-retention'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/server/audit/events', () => ({ recordAuditEvent: vi.fn() }))
vi.mock('@/server/auth/authorization', () => ({ getCurrentUser: vi.fn(), requireAdmin: vi.fn() }))
vi.mock('./client', () => ({ orchestratorScheduledTasksClient: { list: vi.fn(), update: vi.fn() } }))

const admin = {
  id: 'admin',
  name: 'Administrator',
  isPlatformAdmin: true
} as Awaited<ReturnType<typeof getCurrentUser>>

const builtIn: ScheduledTask = {
  id: 'workflow-history',
  name: 'Workflow history retention',
  kind: 'predefined',
  predefinedKey: workflowHistoryRetentionKey,
  actionType: 'clean_workflow_history',
  payload: null,
  enabled: false,
  cronExpression: '30 2 * * *',
  lastRunAt: null,
  nextRunAt: null,
  lastStatus: 'never_run',
  lastError: null,
  createdAt: '2026-11-01T00:00:00Z',
  updatedAt: '2026-11-01T00:00:00Z'
}

describe('workflow history retention settings', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(getCurrentUser).mockResolvedValue(admin)
    vi.mocked(requireAdmin).mockResolvedValue(admin)
  })

  it('hides the setting and denies mutations for non-administrators before reaching the orchestrator', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ ...admin, isPlatformAdmin: false })

    await expect(loadWorkflowHistoryRetention()).resolves.toBeNull()
    const denied = await saveWorkflowHistoryRetentionAction(14)
    expect(denied).toMatchObject({
      ok: false,
      error: { code: 'forbidden' }
    })
    expect(denied.requestId).toBeTruthy()
    expect(orchestratorScheduledTasksClient.list).not.toHaveBeenCalled()
    expect(orchestratorScheduledTasksClient.update).not.toHaveBeenCalled()
  })

  it('reads the built-in setting, defaults to seven days, and keeps a saved override', async () => {
    const custom = {
      ...builtIn,
      id: 'custom',
      kind: 'custom',
      predefinedKey: null,
      payload: { retentionDays: 1 }
    } as const
    vi.mocked(orchestratorScheduledTasksClient.list)
      .mockResolvedValueOnce([custom, builtIn])
      .mockResolvedValueOnce([{ ...builtIn, payload: { retentionDays: 30 } }])

    await expect(loadWorkflowHistoryRetention()).resolves.toMatchObject({
      ok: true,
      data: { retentionDays: 7, enabled: false }
    })
    await expect(loadWorkflowHistoryRetention()).resolves.toMatchObject({
      ok: true,
      data: { retentionDays: 30, enabled: false }
    })
  })

  it('validates the value, updates only the built-in payload, and refreshes both pages', async () => {
    vi.mocked(orchestratorScheduledTasksClient.list).mockResolvedValue([builtIn])
    vi.mocked(orchestratorScheduledTasksClient.update).mockResolvedValue({ ...builtIn, payload: { retentionDays: 14 } })

    await expect(saveWorkflowHistoryRetentionAction(1.5)).resolves.toMatchObject({
      ok: false,
      error: { code: 'validation' }
    })
    expect(orchestratorScheduledTasksClient.list).not.toHaveBeenCalled()

    await expect(saveWorkflowHistoryRetentionAction(14)).resolves.toMatchObject({
      ok: true,
      data: { retentionDays: 14, enabled: false }
    })
    expect(orchestratorScheduledTasksClient.update).toHaveBeenCalledWith(builtIn.id, { payload: { retentionDays: 14 } })
    expect(revalidatePath).toHaveBeenCalledWith('/automations')
    expect(revalidatePath).toHaveBeenCalledWith('/platform/scheduler')
    expect(vi.mocked(recordAuditEvent).mock.lastCall?.[0]).toMatchObject({
      action: 'scheduled_task.update',
      details: { retentionDays: 14 }
    })
  })
})
