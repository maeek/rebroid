import type { AutomationRun } from './automation'

export type ActiveWorkflowRun = Pick<AutomationRun, 'id' | 'automationId' | 'targetApplicationId' | 'createdAt'> & {
  workflowName: string
  status: 'queued' | 'running'
}
