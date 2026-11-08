'use client'

import { useState } from 'react'
import { IconPencil } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTrigger } from '@/components/ui/dialog'
import { MutationButton } from '@/components/ui/mutation-button'
import { Notice } from '@/components/ui/notice'
import { Section } from '@/components/ui/section'
import { usePollingQuery } from '@/hooks/use-polling-query'
import { toast } from '@/hooks/use-toast'
import { getBff, sendBff } from '@/lib/http/bff'
import { dockerOperationLimitsSchema, type DockerOperationLimits } from '@/shared/contracts/docker-operation-limits'
import { DetailFields } from '@/shared/ui/detail-fields'
import { dockerOperationLimitFields, formatOperationLimitDuration } from './docker-operation-limit-fields'
import { DockerOperationLimitsDialog, type OperationLimitsDraft } from './docker-operation-limits-dialog'

const endpoint = '/api/bff/platform/docker-operation-limits'
const loadLimits = () => getBff<DockerOperationLimits>(endpoint)

export const DockerOperationLimitsSection = ({
  onSaved,
  loading = false
}: {
  onSaved: () => void
  loading?: boolean
}) => {
  const { data, error, isLoading, isValidating, mutate } = usePollingQuery('docker:operation-limits', loadLimits, {
    intervalMs: null,
    enabled: !loading
  })
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<OperationLimitsDraft | null>(null)
  const [pending, setPending] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const parsed = dockerOperationLimitsSchema.safeParse(
    Object.fromEntries(dockerOperationLimitFields.map(({ key }) => [key, Number(draft?.[key])]))
  )
  const changed = data && draft && dockerOperationLimitFields.some(({ key }) => Number(draft[key]) !== data[key])
  const setDialogOpen = (next: boolean) => {
    if (pending) return
    if (next) {
      if (!data || loading || isLoading) return
      setDraft({
        maxConcurrentReads: String(data.maxConcurrentReads),
        maxConcurrentLongOperations: String(data.maxConcurrentLongOperations),
        slowRequestWarningMs: String(data.slowRequestWarningMs),
        longOperationTimeoutMs: String(data.longOperationTimeoutMs)
      })
      setSaveError(null)
    }
    setOpen(next)
  }
  const save = async () => {
    if (!open || !parsed.success || !changed || pending) return
    setPending(true)
    setSaveError(null)
    try {
      const saved = await sendBff<DockerOperationLimits>(endpoint, parsed.data, 'PATCH')
      await mutate(() => Promise.resolve(saved))
      setOpen(false)
      toast({ title: 'Docker operation limits saved', variant: 'success' })
      onSaved()
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : 'Try again.')
    } finally {
      setPending(false)
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={setDialogOpen}
    >
      <Section
        surface='panel'
        title='Operation limits'
        description='Control Docker concurrency and operation timing.'
        actions={
          <DialogTrigger asChild>
            <Button
              type='button'
              variant='secondary'
              size='sm'
              disabled={!data || loading || isLoading}
            >
              <IconPencil className='size-4' />
              Edit limits
            </Button>
          </DialogTrigger>
        }
      >
        {!loading && error && !data ? (
          <Notice
            tone='danger'
            title='Operation limits unavailable'
            description='Could not load the current settings.'
            actions={
              <MutationButton
                type='button'
                variant='secondary'
                pending={isValidating}
                pendingLabel='Retrying…'
                onClick={() => void mutate()}
              >
                Try again
              </MutationButton>
            }
          />
        ) : (
          <DetailFields
            loading={loading || isLoading}
            fields={dockerOperationLimitFields.map(field => {
              let value: string | null = null
              if (data) {
                const quantity = data[field.key]
                if (field.unit === 'ms') value = formatOperationLimitDuration(quantity)
                else value = `${quantity} ${quantity === 1 ? field.unit.slice(0, -1) : field.unit}`
              }
              return { label: field.label, value }
            })}
          />
        )}
      </Section>
      {draft ? (
        <DockerOperationLimitsDialog
          draft={draft}
          pending={pending}
          canSave={Boolean(changed && parsed.success)}
          error={saveError}
          onChange={(key, value) => setDraft(current => (current ? { ...current, [key]: value } : current))}
          onSave={() => void save()}
          onCancel={() => setDialogOpen(false)}
        />
      ) : null}
    </Dialog>
  )
}
