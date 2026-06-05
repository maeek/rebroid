import type { ScheduledTask } from '@/server/orchestrator/scheduled-tasks/types'
import type { SortingState } from '@tanstack/react-table'

const sortDate = (left: string | null, right: string | null) => {
  if (!left && !right) return 0
  if (!left) return -1
  if (!right) return 1
  return new Date(left).getTime() - new Date(right).getTime()
}

export const sortTasks = (
  tasks: ScheduledTask[],
  sorting: SortingState,
  actionLabel: (task: ScheduledTask) => string
) => {
  const activeSorting = sorting.length > 0 ? sorting : [{ id: 'name', desc: false }]
  return [...tasks].sort((left, right) => {
    for (const item of activeSorting) {
      const multiplier = item.desc ? -1 : 1
      let result = 0
      if (item.id === 'name') result = left.name.localeCompare(right.name)
      else if (item.id === 'state') {
        result = Number(left.enabled) - Number(right.enabled) || left.lastStatus.localeCompare(right.lastStatus)
      } else if (item.id === 'schedule') result = left.cronExpression.localeCompare(right.cronExpression)
      else if (item.id === 'nextRunAt') result = sortDate(left.nextRunAt, right.nextRunAt)
      else if (item.id === 'lastRunAt') result = sortDate(left.lastRunAt, right.lastRunAt)
      else if (item.id === 'action') result = actionLabel(left).localeCompare(actionLabel(right))
      if (result !== 0) return result * multiplier
    }
    return left.id.localeCompare(right.id)
  })
}
