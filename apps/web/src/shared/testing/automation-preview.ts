import type { Automation } from '@/shared/contracts/automation'

export const previewWorkflow: Automation = {
  id: 'preview-workflow',
  name: 'Daily inventory check',
  ownerUserId: 'preview-owner',
  description: null,
  tags: [],
  definition: {
    apiVersion: 'rebroid.io/automation/v1',
    kind: 'AndroidAutomation',
    metadata: { name: 'Daily inventory check' },
    spec: { steps: [] }
  },
  yaml: '',
  lastRunAt: null,
  lastStatus: 'never_run',
  lastError: null,
  createdAt: '2026-11-07T10:00:00Z',
  updatedAt: '2026-11-07T10:00:00Z'
}
