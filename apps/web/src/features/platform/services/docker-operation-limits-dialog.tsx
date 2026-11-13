'use client'

import { Button } from '@/components/ui/button'
import { DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FormField } from '@/components/ui/form-field'
import { MutationButton } from '@/components/ui/mutation-button'
import { Notice } from '@/components/ui/notice'
import { NumericUnitInput } from '@/components/ui/numeric-unit-input'
import { dockerOperationLimitFields } from './docker-operation-limit-fields'
import type { DockerOperationLimits } from '@/shared/contracts/docker-operation-limits'

export type OperationLimitsDraft = Record<keyof DockerOperationLimits, string>

export const DockerOperationLimitsDialog = ({
  draft,
  pending,
  canSave,
  error,
  onChange,
  onSave,
  onCancel
}: {
  draft: OperationLimitsDraft
  pending: boolean
  canSave: boolean
  error: string | null
  onChange: (key: keyof DockerOperationLimits, value: string) => void
  onSave: () => void
  onCancel: () => void
}) => (
  <DialogContent
    data-editor-dialog=''
    className='sm:max-w-lg'
  >
    <DialogHeader>
      <DialogTitle>Edit operation limits</DialogTitle>
      <DialogDescription>
        Changes take effect after saving. Running operations keep their current deadlines.
      </DialogDescription>
    </DialogHeader>
    <form
      onSubmit={event => {
        event.preventDefault()
        onSave()
      }}
      className='grid gap-6'
    >
      <div className='grid gap-6'>
        {dockerOperationLimitFields.map(field => (
          <FormField
            key={field.key}
            controlId={`docker-limit-${field.key}`}
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
              disabled={pending}
              value={draft[field.key]}
              onChange={event => onChange(field.key, event.target.value)}
            />
          </FormField>
        ))}
      </div>
      <p className='text-sm text-foreground-muted'>
        Docker mutations run one at a time, independently of these limits.
      </p>
      {error ? (
        <Notice
          tone='danger'
          title='Could not save Docker limits'
          description={error}
        />
      ) : null}
      <DialogFooter>
        <Button
          type='button'
          variant='secondary'
          disabled={pending}
          onClick={onCancel}
        >
          Cancel
        </Button>
        <MutationButton
          type='submit'
          pending={pending}
          animate
          pendingLabel='Saving…'
          disabled={!canSave}
        >
          Save limits
        </MutationButton>
      </DialogFooter>
    </form>
  </DialogContent>
)
