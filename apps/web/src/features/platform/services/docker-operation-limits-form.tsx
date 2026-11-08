'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { FormLoadingContext } from '@/components/ui/form-loading-boundary'
import { MutationButton } from '@/components/ui/mutation-button'
import { Notice } from '@/components/ui/notice'
import { NumericUnitInput } from '@/components/ui/numeric-unit-input'
import { Section } from '@/components/ui/section'
import { usePollingQuery } from '@/hooks/use-polling-query'
import { toast } from '@/hooks/use-toast'
import { getBff, sendBff } from '@/lib/http/bff'
import { dockerOperationLimitsSchema, type DockerOperationLimits } from '@/shared/contracts/docker-operation-limits'

const endpoint = '/api/bff/platform/docker-operation-limits'
const fields = [
  {
    key: 'maxConcurrentReads',
    label: 'Concurrent reads',
    description: 'Maximum Docker read operations in flight.',
    unit: 'reads',
    min: 1,
    max: 64
  },
  {
    key: 'maxConcurrentLongOperations',
    label: 'Concurrent long operations',
    description: 'Maximum concurrent builds, pulls, and archive operations.',
    unit: 'operations',
    min: 1,
    max: 16
  },
  {
    key: 'slowRequestWarningMs',
    label: 'Slow-operation warning',
    description: 'Record a warning when an operation exceeds this duration.',
    unit: 'ms',
    min: 100,
    max: 300_000
  },
  {
    key: 'longOperationTimeoutMs',
    label: 'Long-operation timeout',
    description: 'Deadline used by new long operations unless they set a specific timeout.',
    unit: 'ms',
    min: 1000,
    max: 3_600_000
  }
] as const

const loadLimits = () => getBff<DockerOperationLimits>(endpoint)

export const DockerOperationLimitsForm = ({ onSaved, loading = false }: { onSaved: () => void; loading?: boolean }) => {
  const { data, error, isLoading, isValidating, mutate } = usePollingQuery('docker:operation-limits', loadLimits, {
    intervalMs: null,
    enabled: !loading
  })
  const [draft, setDraft] = useState<Partial<Record<keyof DockerOperationLimits, string>>>({})
  const [pending, setPending] = useState(false)
  const value = Object.fromEntries(fields.map(({ key }) => [key, Number(draft[key] ?? data?.[key])]))
  const parsed = dockerOperationLimitsSchema.safeParse(value)
  const changed = fields.some(({ key }) => draft[key] !== undefined && Number(draft[key]) !== data?.[key])

  const save = async () => {
    if (!parsed.success || !changed || pending) return
    setPending(true)
    try {
      const saved = await sendBff<DockerOperationLimits>(endpoint, parsed.data, 'PATCH')
      await mutate(() => Promise.resolve(saved))
      setDraft({})
      toast({ title: 'Docker operation limits saved', variant: 'success' })
      onSaved()
    } catch (cause) {
      toast({
        title: 'Could not save Docker limits',
        description: cause instanceof Error ? cause.message : 'Try again.',
        variant: 'danger'
      })
    } finally {
      setPending(false)
    }
  }

  return (
    <Section
      surface='panel'
      title='Operation limits'
      description='Changes apply immediately. Running operations keep their current deadlines; mutations remain serialized.'
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
        <form
          onSubmit={event => {
            event.preventDefault()
            void save()
          }}
          className='grid gap-6'
        >
          <FormLoadingContext.Provider value={loading || isLoading}>
            <div className='grid gap-6 sm:grid-cols-2 xl:grid-cols-4'>
              {fields.map(field => (
                <FormField
                  key={field.key}
                  layout='vertical'
                  label={field.label}
                  description={field.description}
                >
                  <NumericUnitInput
                    type='number'
                    unit={field.unit}
                    min={field.min}
                    max={field.max}
                    step={1}
                    required
                    disabled={pending || loading || isLoading}
                    value={draft[field.key] ?? data?.[field.key] ?? ''}
                    onChange={event => setDraft(current => ({ ...current, [field.key]: event.target.value }))}
                  />
                </FormField>
              ))}
            </div>
          </FormLoadingContext.Provider>
          <div className='flex flex-wrap gap-2'>
            <MutationButton
              type='submit'
              pending={pending}
              pendingLabel='Saving…'
              disabled={!changed || !parsed.success || loading || isLoading}
            >
              Save limits
            </MutationButton>
            <Button
              type='button'
              variant='ghost'
              disabled={!changed || pending}
              onClick={() => setDraft({})}
            >
              Discard changes
            </Button>
          </div>
        </form>
      )}
    </Section>
  )
}
