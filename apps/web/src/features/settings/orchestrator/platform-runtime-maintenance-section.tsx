'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ConfirmMutationDialog } from '@/components/ui/confirm-mutation-dialog'
import { Notice, type NoticeTone } from '@/components/ui/notice'
import { Section } from '@/components/ui/section'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { ResourceLink } from '@/shared/ui/resource-link'
import { runtimeMaintenanceOperations, type RuntimeMaintenanceOperation } from './runtime-maintenance-operations'

export const PlatformRuntimeMaintenanceSection = ({
  onMaintenanceComplete,
  onRestore,
  loading = false,
  disabled = false
}: {
  onMaintenanceComplete?: () => void
  onRestore?: () => void
  loading?: boolean
  disabled?: boolean
}) => {
  const [selected, setSelected] = useState<RuntimeMaintenanceOperation | null>(null)
  const [pending, setPending] = useState(false)
  const [feedback, setFeedback] = useState<{ title: string; description: string; tone: NoticeTone } | null>(null)
  const runSelected = async () => {
    if (!selected || pending) return
    setPending(true)
    setFeedback(null)
    try {
      const description = await selected.run()
      setFeedback({ title: `${selected.title}: cleanup complete`, description, tone: 'success' })
      onMaintenanceComplete?.()
    } catch (error) {
      setFeedback({
        title: `${selected.title}: cleanup failed`,
        description: getDisplayErrorMessage(error),
        tone: 'danger'
      })
    } finally {
      setPending(false)
      setSelected(null)
    }
  }

  return (
    <>
      <Section
        surface='plain'
        title='Maintenance'
        description='Run cleanup independently of settings changes.'
        actions={
          <ResourceLink
            href='/platform/scheduler'
            aria-label='Manage cleanup schedules'
            className='text-sm whitespace-nowrap'
          >
            Schedules
          </ResourceLink>
        }
        contentClassName='gap-4'
      >
        {feedback ? (
          <Notice
            title={feedback.title}
            description={feedback.description}
            tone={feedback.tone}
          />
        ) : null}
        <ul className='grid min-w-0 gap-x-10 gap-y-6 lg:grid-cols-2'>
          {runtimeMaintenanceOperations.map(operation => (
            <li
              key={operation.key}
              className='flex min-w-0 items-start justify-between gap-4'
            >
              <div className='grid min-w-0 gap-1'>
                <h3 className='text-sm font-medium'>{operation.title}</h3>
                <p className='max-w-xl text-sm leading-5 text-foreground-muted'>{operation.description}</p>
              </div>
              <Button
                variant={operation.key === 'all' ? 'danger-ghost' : 'secondary'}
                size='sm'
                disabled={loading || disabled || pending}
                aria-label={`Clean up ${operation.title.toLowerCase()}`}
                onClick={() => setSelected(operation)}
              >
                Clean up…
              </Button>
            </li>
          ))}
        </ul>
        <div className='flex min-w-0 flex-wrap items-center justify-between gap-4 pt-4'>
          <div className='grid gap-1'>
            <h3 className='text-sm font-medium'>Restore default settings</h3>
            <p className='text-sm text-foreground-muted'>
              Reset runtime defaults and optional service connections. Changes are saved immediately.
            </p>
          </div>
          <Button
            variant='ghost'
            size='sm'
            disabled={loading || disabled || pending}
            onClick={onRestore}
          >
            Restore defaults…
          </Button>
        </div>
      </Section>
      <ConfirmMutationDialog
        open={selected !== null}
        title={selected ? `Clean up ${selected.title.toLowerCase()}?` : 'Clean up resources?'}
        description={selected?.description}
        consequence={selected?.consequence}
        confirmLabel='Clean up'
        pending={pending}
        pendingLabel='Cleaning up…'
        onConfirm={() => void runSelected()}
        onOpenChange={open => {
          if (!open) setSelected(null)
        }}
      />
    </>
  )
}
