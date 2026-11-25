import type { AutomationRun } from './automation'

export type ActiveWorkflowRun = Pick<
  AutomationRun,
  'id' | 'automationId' | 'targetDeviceId' | 'targetKind' | 'createdAt'
> & {
  workflowName: string | null
  status: 'queued' | 'running'
}
