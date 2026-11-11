'use client'

import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Section } from '@/components/ui/section'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { UserAvatarInput } from '@/shared/ui/user-avatar/user-avatar-input'
import type { GroupDraft } from '../group-edit-page-model'
import type { UserDraft } from '../user-edit-page-model'

export const UserAccountSections = ({
  draft,
  onChange,
  disabled = false,
  onAvatarPendingChange
}: {
  onAvatarPendingChange?: (pending: boolean) => void
  draft?: UserDraft
  onChange?: (patch: Partial<UserDraft>) => void
  disabled?: boolean
}) => (
  <div className='grid min-w-0 gap-6'>
    <Section
      title='Identity'
      surface='plain'
    >
      <div className='grid gap-x-form-column gap-y-4 sm:grid-cols-2'>
        <FormField
          layout='vertical'
          label='Username'
          required
        >
          <Input
            value={draft?.username ?? ''}
            required
            autoComplete='username'
            onChange={event => onChange?.({ username: event.target.value })}
          />
        </FormField>
        <FormField
          layout='vertical'
          label='Display name'
        >
          <Input
            value={draft?.name ?? ''}
            autoComplete='name'
            onChange={event => onChange?.({ name: event.target.value })}
          />
        </FormField>
      </div>
    </Section>
    <Section
      title='Password'
      surface='plain'
    >
      <FormField
        layout='vertical'
        label='New password'
        description='Leave empty to keep the current password. A reset requires a change at the next sign-in.'
      >
        <Input
          value={draft?.password ?? ''}
          type='password'
          autoComplete='new-password'
          onChange={event => onChange?.({ password: event.target.value })}
        />
      </FormField>
    </Section>
    <Section
      title='Account status'
      surface='plain'
    >
      <FormField
        layout='vertical'
        label='Active account'
        description='Allow this user to sign in.'
      >
        <Switch
          disabled={disabled}
          checked={!draft?.disabled}
          onCheckedChange={checked => onChange?.({ disabled: !checked })}
        />
      </FormField>
    </Section>
    <Section
      title='Appearance'
      surface='plain'
    >
      <UserAvatarInput
        onPendingChange={onAvatarPendingChange}
        name={draft?.name || draft?.username || ''}
        avatar={draft?.avatarDataUrl ?? null}
        disabled={disabled}
        onChange={avatarDataUrl => onChange?.({ avatarDataUrl })}
      />
    </Section>
  </div>
)

export const GroupDetailsSections = ({
  draft,
  onChange,
  disabled = false
}: {
  draft?: GroupDraft
  onChange?: (patch: Partial<GroupDraft>) => void
  disabled?: boolean
}) => (
  <div className='grid min-w-0 gap-6'>
    <Section
      title='Group details'
      surface='plain'
    >
      <div className='grid gap-x-form-column gap-y-4 sm:grid-cols-2'>
        <FormField
          layout='vertical'
          label='Name'
          description='A recognizable name for this group.'
          required
        >
          <Input
            value={draft?.name ?? ''}
            disabled={disabled}
            required
            onChange={event => onChange?.({ name: event.target.value })}
          />
        </FormField>
      </div>
    </Section>
    <Section
      title='Notes'
      surface='plain'
    >
      <FormField
        layout='vertical'
        label='Description'
        description='Help administrators choose the right group for a user.'
      >
        <Textarea
          value={draft?.description ?? ''}
          disabled={disabled}
          rows={3}
          onChange={event => onChange?.({ description: event.target.value })}
        />
      </FormField>
    </Section>
  </div>
)
