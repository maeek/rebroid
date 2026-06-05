import { describe, expect, it } from '@jest/globals'
import { sortTasks } from './scheduled-tasks-table-utils'
import type { ScheduledTask } from '@/server/orchestrator/scheduled-tasks/types'

const task = (patch: Partial<ScheduledTask>): ScheduledTask => ({
  id: patch.id ?? 'task',
  name: patch.name ?? 'Task',
  enabled: patch.enabled ?? true,
  kind: patch.kind ?? 'custom',
  predefinedKey: null,
  cronExpression: patch.cronExpression ?? '0 1 * * *',
  actionType: patch.actionType ?? 'prune_images',
  payload: null,
  lastRunAt: patch.lastRunAt ?? null,
  nextRunAt: patch.nextRunAt ?? null,
  lastStatus: patch.lastStatus ?? 'never_run',
  lastError: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
})

describe('scheduled tasks table utils', () => {
  it('sorts by task name by default', () => {
    const tasks = [task({ id: 'b', name: 'Beta' }), task({ id: 'a', name: 'Alpha' })]

    expect(sortTasks(tasks, [], item => item.actionType).map(item => item.id)).toEqual(['a', 'b'])
  })

  it('sorts nullable dates', () => {
    const tasks = [
      task({ id: 'never', nextRunAt: null }),
      task({ id: 'later', nextRunAt: '2026-01-03T00:00:00.000Z' }),
      task({ id: 'sooner', nextRunAt: '2026-01-02T00:00:00.000Z' })
    ]

    expect(sortTasks(tasks, [{ id: 'nextRunAt', desc: false }], item => item.actionType).map(item => item.id)).toEqual([
      'never',
      'sooner',
      'later'
    ])
  })
})
