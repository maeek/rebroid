import type { Automation, AutomationGridRow } from '@/shared/contracts/automation'

const previewSummary = {
  id: 'preview-workflow',
  name: 'Daily inventory check',
  ownerUserId: 'preview-owner',
  description: null,
  tags: [],
  lastRunAt: null,
  lastRunId: null,
  lastStatus: 'never_run',
  lastError: null,
  createdAt: '2026-11-07T10:00:00Z',
  updatedAt: '2026-11-07T10:00:00Z'
} satisfies Omit<AutomationGridRow, 'stepCount'>

export const previewWorkflowGridRow: AutomationGridRow = { ...previewSummary, stepCount: 0 }

export const previewWorkflow: Automation = {
  ...previewSummary,
  definition: {
    apiVersion: 'rebroid.io/automation/v1',
    kind: 'AndroidAutomation',
    metadata: { name: 'Daily inventory check' },
    spec: { steps: [] }
  },
  yaml: ''
}
