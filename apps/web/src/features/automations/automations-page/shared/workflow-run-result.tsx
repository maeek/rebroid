'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Notice } from '@/components/ui/notice'
import { DateTimeValue } from '@/shared/ui/date-time-value'
import { ResourceLink } from '@/shared/ui/resource-link'
import type { AutomationLastStatus } from '@/shared/contracts/automation'

const statusVariant = (status: AutomationLastStatus) => {
  if (status === 'success') return 'success'
  if (status === 'failed') return 'danger'
  return 'neutral'
}

const statusLabel = (status: AutomationLastStatus) => {
  if (status === 'never_run') return 'Never run'
  if (status === 'success') return 'Success'
  if (status === 'running') return 'Running'
  return 'Failed'
}

export const WorkflowRunResult = ({
  status,
  at,
  error,
  workflowId
}: {
  status: AutomationLastStatus
  at: string | null
  error: string | null
  workflowId: string
}) => {
  const [open, setOpen] = useState(false)
  return (
    <div className='grid justify-items-start gap-1'>
      {status === 'never_run' ? (
        <span className='text-foreground-muted'>Never run</span>
      ) : (
        <>
          <Badge variant={statusVariant(status)}>{statusLabel(status)}</Badge>
          <DateTimeValue
            value={at}
            compact
          />
        </>
      )}
      {error ? (
        <Button
          type='button'
          size='sm'
          variant='danger-ghost'
          className='h-auto px-0 py-0.5'
          onClick={() => setOpen(true)}
        >
          View failure
        </Button>
      ) : null}
      <Dialog
        open={open}
        onOpenChange={setOpen}
      >
        <DialogContent className='sm:max-w-xl'>
          <DialogHeader>
            <DialogTitle>Last run failure</DialogTitle>
            <DialogDescription>Recorded failure from the most recent execution.</DialogDescription>
          </DialogHeader>
          <Notice
            tone='danger'
            title='Execution failed'
            description={error}
          />
          <ResourceLink href={`/automations/${encodeURIComponent(workflowId)}/traces`}>Open run history</ResourceLink>
        </DialogContent>
      </Dialog>
    </div>
  )
}
