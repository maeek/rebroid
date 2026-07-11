'use client'

import { useState } from 'react'
import { IconCheck, IconLock, IconShieldCheck, IconX } from '@tabler/icons-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { approvalRequestFromEvent } from '../ai-agent-chat-presentation'
import type { AutomationRunEvent } from '@/server/orchestrator/automations/types'

export const ApprovalEventView = ({
  event,
  onApprove
}: {
  event: AutomationRunEvent
  onApprove?: (program: string) => void
}) => {
  const approval = approvalRequestFromEvent(event)
  const [decision, setDecision] = useState<'approved' | 'rejected' | null>(null)
  if (!approval) return null

  const approve = () => {
    setDecision('approved')
    onApprove?.(approval.program)
  }

  return (
    <section
      aria-label='Approval required'
      className='overflow-hidden rounded-panel border border-warning/35 bg-warning/8 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1'
    >
      <div className='flex items-start gap-3 p-3'>
        <span className='flex size-8 shrink-0 items-center justify-center rounded-panel border border-warning/25 bg-warning/12 text-warning'>
          <IconShieldCheck className='size-4' />
        </span>
        <div className='min-w-0 flex-1'>
          <div className='flex flex-wrap items-center gap-2'>
            <h4 className='text-xs font-medium text-foreground'>Approval required</h4>
            <Badge
              variant='warning'
              className='font-mono text-xs font-medium'
            >
              {approval.program}
            </Badge>
          </div>
          <p className='mt-1 text-xs leading-5 text-foreground-muted'>{approval.reason}</p>
          <p className='mt-1 flex items-center gap-1.5 text-xs text-foreground-muted/80'>
            <IconLock className='size-3' />
            Approval applies to one follow-up run and the read-only command allowlist.
          </p>
        </div>
      </div>
      {decision ? (
        <div
          role='status'
          className='flex items-center gap-2 border-t border-warning/20 px-3 py-2 text-xs text-foreground-muted'
        >
          {decision === 'approved' ? <IconCheck className='size-4 text-success' /> : <IconX className='size-4' />}
          {decision === 'approved' ? 'Approval queued as a follow-up.' : 'Request kept blocked.'}
        </div>
      ) : (
        <div className='flex flex-wrap justify-end gap-2 border-t border-warning/20 px-3 py-2'>
          <Button
            type='button'
            size='sm'
            variant='ghost'
            onClick={() => setDecision('rejected')}
          >
            Keep blocked
          </Button>
          <Button
            type='button'
            size='sm'
            variant='outline'
            disabled={!onApprove}
            onClick={approve}
          >
            <IconShieldCheck className='size-4' />
            Allow once
          </Button>
        </div>
      )}
    </section>
  )
}
