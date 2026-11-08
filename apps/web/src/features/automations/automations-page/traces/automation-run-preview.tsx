'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { AutomationRunInspector } from './automation-run-inspector'
import type { AutomationRun } from '@/shared/contracts/automation'
const run: AutomationRun = {
  id: 'preview-run',
  automationId: 'preview-workflow',
  automationTriggerId: null,
  ownerUserId: 'preview-owner',
  targetApplicationId: 'preview-app',
  targetProfileMode: 'persistent',
  targetProfileName: 'default',
  trigger: 'manual',
  status: 'failed',
  startedAt: '2026-11-07T10:00:00Z',
  completedAt: '2026-11-07T10:01:00Z',
  createdAt: '2026-11-07T10:00:00Z',
  updatedAt: '2026-11-07T10:01:00Z',
  error: 'Target app did not finish starting.',
  stepResults: [
    {
      stepId: 'launch',
      uses: 'android.launchApp',
      status: 'failed',
      startedAt: '2026-11-07T10:00:00Z',
      completedAt: '2026-11-07T10:01:00Z',
      output: null,
      error: 'Android boot timed out.'
    }
  ]
}
export const AutomationRunPreview = () => {
  const [open, setOpen] = useState(false)
  return (
    <main className='p-6'>
      <Button onClick={() => setOpen(true)}>Inspect failed run</Button>
      <AutomationRunInspector
        run={open ? run : null}
        targetName='Inventory worker'
        onClose={() => setOpen(false)}
      />
    </main>
  )
}
