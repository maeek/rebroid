import type { Automation, AutomationGridRow, AutomationOption } from '@/shared/contracts/automation'

export const previewWorkflowOption: AutomationOption = {
  id: 'preview-workflow',
  name: 'Daily inventory check',
  description: null,
  tags: [],
  topLevelStepCount: 0
}

const { id, name, description, tags } = previewWorkflowOption
const previewSummary = {
  id,
  name,
  description,
  tags,
  ownerUserId: 'preview-owner',
  lastRunAt: null,
  lastRunId: null,
  lastStatus: 'never_run',
  lastError: null,
  createdAt: '2026-11-07T10:00:00Z',
  updatedAt: '2026-11-07T10:00:00Z'
} satisfies Omit<AutomationGridRow, 'stepCount' | 'targetApplicationIds'>

export const previewWorkflowGridRow: AutomationGridRow = { ...previewSummary, stepCount: 0, targetApplicationIds: [] }

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
