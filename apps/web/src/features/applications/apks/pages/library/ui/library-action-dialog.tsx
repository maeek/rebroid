'use client'

import { ConfirmMutationDialog } from '@/components/ui/confirm-mutation-dialog'
import { FormField } from '@/components/ui/form-field'
import { RadioGroup, RadioOption } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import { formatBytes } from '@/lib/format-bytes'
import {
  availableBlockScopes,
  blockRuleValue,
  entryLabel,
  getActionExclusion,
  scopeLabels
} from '../model/library-grid'
import type { ApkBlockScope, ApkLibraryAction, ApkLibraryEntry } from '@/shared/contracts/apk-library'

export type PendingLibraryAction = { action: ApkLibraryAction; entries: ApkLibraryEntry[] }

export const ApkLibraryActionDialog = ({
  pendingAction,
  entries,
  scope,
  reason,
  pending,
  error,
  setScope,
  setReason,
  close,
  confirm
}: {
  pendingAction: PendingLibraryAction | null
  entries: ApkLibraryEntry[]
  scope: ApkBlockScope
  reason: string
  pending: boolean
  error?: string
  setScope: (scope: ApkBlockScope) => void
  setReason: (reason: string) => void
  close: () => void
  confirm: () => void
}) => {
  const action = pendingAction?.action ?? 'delete'
  const selected = pendingAction?.entries ?? []
  const skipped = selected.flatMap(entry => {
    const exclusion = getActionExclusion(entry, action, scope)
    return exclusion ? [{ entry, exclusion }] : []
  })
  const eligible = selected.filter(entry => !getActionExclusion(entry, action, scope))
  const scopes = action === 'delete' ? [] : availableBlockScopes(selected, action)
  const targets = new Set(eligible.map(entry => blockRuleValue(entry, scope)))
  const affected = action === 'delete' ? eligible : entries.filter(entry => targets.has(blockRuleValue(entry, scope)))
  const apps = new Map(affected.flatMap(entry => entry.apps.map(app => [app.id, app.name])))
  const bytes = eligible.reduce((sum, entry) => sum + (entry.sizeBytes ?? 0), 0)
  const label = { block: 'Block APKs', unblock: 'Unblock APKs', delete: 'Delete files' }[action]
  const description = {
    block: 'Block future uploads and installs across Rebroid. Existing installations stay on devices.',
    unblock: 'Remove the selected type of block. Other matching rules can still block the APK.',
    delete: 'Permanently remove unused files and their upload records. Existing blocks stay in effect.'
  }[action]

  return (
    <ConfirmMutationDialog
      open={Boolean(pendingAction)}
      title={`${label}?`}
      description={description}
      confirmLabel={label}
      pendingLabel='Applying…'
      pending={pending}
      tone={action === 'unblock' ? 'warning' : 'danger'}
      confirmDisabled={!eligible.length || (action === 'block' && !reason.trim())}
      error={error}
      onConfirm={confirm}
      onOpenChange={open => {
        if (!open) close()
      }}
    >
      {action !== 'delete' ? (
        <RadioGroup
          aria-label='Block scope'
          value={scope}
          onValueChange={setScope}
          disabled={pending}
          className='grid gap-1'
        >
          <RadioOption
            value='sha256'
            disabled={!scopes.includes('sha256')}
          >
            <span className='grid gap-1 py-2'>
              <span>{scopeLabels.sha256}</span>
              <span className='text-xs text-foreground-muted'>Matches only the selected file checksum.</span>
            </span>
          </RadioOption>
          <RadioOption
            value='package'
            disabled={!scopes.includes('package')}
          >
            <span className='grid gap-1 py-2'>
              <span>{scopeLabels.package}</span>
              <span className='text-xs text-foreground-muted'>Matches every version and signer of that package.</span>
            </span>
          </RadioOption>
        </RadioGroup>
      ) : null}
      {action === 'block' ? (
        <FormField
          label='Reason'
          layout='vertical'
          required
        >
          <Textarea
            name='reason'
            autoComplete='off'
            rows={2}
            value={reason}
            maxLength={500}
            disabled={pending}
            onChange={event => setReason(event.target.value)}
          />
        </FormField>
      ) : null}
      {action !== 'delete' && targets.size ? (
        <p className='text-sm text-foreground-muted [overflow-wrap:anywhere]'>
          {targets.size} {scope === 'package' ? 'package names' : 'file checksums'}
          {scope === 'package' ? ` · ${Array.from(targets).join(', ')}` : ''}
        </p>
      ) : null}
      {action === 'block' && scope === 'package' && affected.length ? (
        <p className='text-sm text-foreground-muted'>
          {affected.length} {affected.length === 1 ? 'library entry matches' : 'library entries match'} this scope.
        </p>
      ) : null}
      {action === 'block' && apps.size ? (
        <p className='text-sm text-foreground-muted [overflow-wrap:anywhere]'>
          Apps that will need a replacement for future installs: {Array.from(apps.values()).join(', ')}.
        </p>
      ) : null}
      {action === 'delete' && eligible.length ? (
        <p className='text-sm text-foreground-muted'>
          {eligible.length} {eligible.length === 1 ? 'file' : 'files'} · {formatBytes(bytes)} to reclaim
        </p>
      ) : null}
      {eligible.length ? (
        <ul className='grid gap-1 pl-4 text-sm [overflow-wrap:anywhere] list-disc'>
          {eligible.map(entry => (
            <li key={entry.id}>{entryLabel(entry)}</li>
          ))}
        </ul>
      ) : null}
      {skipped.length ? (
        <div className='grid gap-1 text-sm [overflow-wrap:anywhere]'>
          <p className='font-medium'>Will be skipped</p>
          <ul className='grid gap-1 pl-4 list-disc text-foreground-muted'>
            {skipped.map(({ entry, exclusion }) => (
              <li key={entry.id}>
                {entryLabel(entry)} · {exclusion}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </ConfirmMutationDialog>
  )
}
