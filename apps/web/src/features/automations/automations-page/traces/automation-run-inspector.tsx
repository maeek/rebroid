'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Notice } from '@/components/ui/notice'
import { Section } from '@/components/ui/section'
import { useDialogPayload } from '@/hooks/use-dialog-payload'
import { AutomationRunLiveEvents } from '@/shared/ui/automation/automation-run-live-events'
import { DateTimeValue } from '@/shared/ui/date-time-value'
import { DetailFields } from '@/shared/ui/detail-fields'
import type { AutomationRun, AutomationRunStatus } from '@/shared/contracts/automation'

const statusVariant = (status: AutomationRunStatus | 'skipped') => {
  if (status === 'failed') return 'danger'
  if (status === 'success') return 'success'
  return 'neutral'
}

export const AutomationRunInspector = ({
  run: currentRun,
  targetName,
  onClose
}: {
  run: AutomationRun | null
  targetName?: string
  onClose: () => void
}) => {
  const { payload: run, onOpenChangeComplete } = useDialogPayload(currentRun)
  return (
    <Dialog
      open={Boolean(currentRun)}
      onOpenChangeComplete={onOpenChangeComplete}
      onOpenChange={open => {
        if (!open) onClose()
      }}
    >
      <DialogContent className='max-h-[90dvh] overflow-y-auto sm:max-w-4xl'>
        <DialogHeader>
          <DialogTitle>Run {run?.id.slice(0, 8)}</DialogTitle>
          <DialogDescription>Execution details, failed steps, and recorded events.</DialogDescription>
        </DialogHeader>
        {run ? (
          <div className='grid min-w-0 gap-6'>
            {run.error ? (
              <Notice
                tone='danger'
                title='Execution failed'
                description={run.error}
              />
            ) : null}
            <DetailFields
              fields={[
                {
                  label: 'Status',
                  value: (
                    <Badge
                      className='w-fit capitalize'
                      variant={statusVariant(run.status)}
                    >
                      {run.status}
                    </Badge>
                  )
                },
                { label: 'Started', value: <DateTimeValue value={run.startedAt ?? run.createdAt} /> },
                { label: 'Target', value: targetName ?? run.targetApplicationId },
                { label: 'Source', value: run.trigger },
                {
                  label: 'Profile',
                  value: `${run.targetProfileName ?? 'default'} · ${run.targetProfileMode ?? 'persistent'}`
                }
              ]}
            />
            <div className='flex flex-wrap gap-2'>
              <Button
                asChild
                variant='outline'
              >
                <Link href={`/app/${encodeURIComponent(run.targetApplicationId)}`}>Inspect target app</Link>
              </Button>
              <Button
                asChild
                variant='outline'
              >
                <Link href={`/automations/${encodeURIComponent(run.automationId)}`}>Open workflow</Link>
              </Button>
            </div>
            {run.stepResults.length > 0 ? (
              <Section
                surface='plain'
                title='Step results'
                contentClassName='gap-3'
              >
                {run.stepResults.map((step, index) => (
                  <div
                    key={`${step.path ?? step.stepId}-${index}`}
                    className='grid min-w-0 gap-1 rounded-control bg-control/25 px-3 py-3'
                  >
                    <div className='flex flex-wrap items-center justify-between gap-2'>
                      <span className='text-sm font-medium'>{step.stepId}</span>
                      <Badge variant={statusVariant(step.status)}>{step.status}</Badge>
                    </div>
                    <p className='text-xs text-foreground-muted'>{step.uses}</p>
                    {step.error ? (
                      <p className='mt-1 whitespace-pre-wrap break-words text-sm text-danger'>{step.error}</p>
                    ) : null}
                  </div>
                ))}
              </Section>
            ) : null}
            <Section
              surface='plain'
              title='Recorded events'
            >
              <AutomationRunLiveEvents
                key={run.id}
                run={run}
                allowCancel={false}
              />
            </Section>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
