import { request } from '../request'
import type { SaveScheduledTaskInput, ScheduledTask, ScheduledTaskAction } from './types'

export const orchestratorScheduledTasksClient = {
  listActions() {
    return request<ScheduledTaskAction[]>('/scheduled-tasks/actions')
  },

  list() {
    return request<ScheduledTask[]>('/scheduled-tasks')
  },

  create(input: SaveScheduledTaskInput) {
    return request<ScheduledTask>('/scheduled-tasks', {
      method: 'POST',
      body: JSON.stringify(input)
    })
  },

  update(id: string, input: Partial<SaveScheduledTaskInput>) {
    return request<ScheduledTask>(`/scheduled-tasks/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input)
    })
  },

  runNow(id: string) {
    return request<ScheduledTask>(`/scheduled-tasks/${encodeURIComponent(id)}/run`, { method: 'POST' })
  },

  remove(id: string) {
    return request<ScheduledTask>(`/scheduled-tasks/${encodeURIComponent(id)}`, { method: 'DELETE' })
  }
}
