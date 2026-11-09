import { ScheduledTasksPage } from './scheduled-tasks-page'
import type { ScheduledTask, ScheduledTaskAction } from '@/shared/contracts/scheduled-task'

export const schedulerPreviewActions: ScheduledTaskAction[] = [
  { type: 'clean_uploaded_apks', label: 'Clean APK uploads', description: 'Remove unreferenced APK uploads.' },
  { type: 'clean_runtime_logs', label: 'Clean runtime logs', description: 'Remove expired runtime log files.' },
  { type: 'prune_images', label: 'Prune images', description: 'Remove unused Docker images.' },
  { type: 'prune_all', label: 'Full cleanup', description: 'Remove unused Docker resources.' }
]

const previewNames = new Map([
  ['prune_images', 'Prune Docker images'],
  ['prune_all', 'Full Docker cleanup']
])
const previewSchedules = ['0 2 * * *', '0 4 * * 0', '0 3 * * *', '0 5 1 * *']

export const schedulerPreviewTasks: ScheduledTask[] = [
  ...schedulerPreviewActions.map((action, index): ScheduledTask => ({
    id: `task-${index}`,
    name: previewNames.get(action.type) ?? action.label,
    actionType: action.type,
    enabled: index < 3,
    kind: 'predefined',
    predefinedKey: action.type,
    cronExpression: previewSchedules[index],
    payload: null,
    lastRunAt: index === 0 ? '2026-11-07T02:00:00.000Z' : null,
    nextRunAt: index < 3 ? '2026-11-08T02:00:00.000Z' : null,
    lastStatus: index === 0 ? 'success' : 'never_run',
    lastError: null,
    createdAt: '2026-11-01T12:00:00.000Z',
    updatedAt: '2026-11-07T12:00:00.000Z'
  })),
  {
    id: 'custom-cleanup',
    name: 'Weekend image cleanup',
    actionType: 'prune_images',
    enabled: false,
    kind: 'custom',
    predefinedKey: null,
    cronExpression: '0 4 * * 0',
    payload: { danglingOnly: false },
    lastRunAt: '2026-11-07T04:00:00.000Z',
    nextRunAt: null,
    lastStatus: 'failed',
    lastError: 'Docker is temporarily unavailable. Check the service connection before retrying.',
    createdAt: '2026-11-01T12:00:00.000Z',
    updatedAt: '2026-11-07T04:00:00.000Z'
  }
]

export const ScheduledTasksPreview = () => (
  <ScheduledTasksPage
    initialActions={schedulerPreviewActions}
    initialTasks={schedulerPreviewTasks}
  />
)
