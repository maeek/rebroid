'use client'

import { useMemo, useState } from 'react'
import { IconDeviceFloppy } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Section } from '@/components/ui/section'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/hooks/use-toast'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { updateUserAction } from '@/server/users/actions/update-user-action'
import { unwrapActionResult } from '@/shared/actions/action-result'
import { useResourceLimitBounds } from '@/shared/model/settings/use-resource-limit-bounds'
import { PageBackdrop } from '@/shared/ui/page/page-backdrop'
import { PageHeader } from '@/shared/ui/page/page-header'
import { StandardPage } from '@/shared/ui/page/page-layout'
import { UserAvatarInput } from '@/shared/ui/user-avatar/user-avatar-input'
import { getHslColorFromCharCode, getHslColorFromCharCodeForeground } from '@/utils/hsl-from-text'
import { GroupMembershipPicker } from './components/group-membership-picker'
import { FormField } from '@/components/ui/form-field'
import { PermissionSwitchTable } from './components/permission-switch-table'
import { QuotaFields } from './components/quota-fields'
import { buildUserUpdateInput, getPermissionInheritanceMap, toUserDraft, toUserRole } from './user-edit-page-model'
import type { UserDraft } from './user-edit-page-model'
import type { PublicUser, UserGroup } from '@/server/auth/user'

export const UserEditPage = ({ user, groups }: { user: PublicUser; groups: UserGroup[] }) => {
  const router = useRouter()
  const [draft, setDraft] = useState(() => toUserDraft(user))
  const [isSaving, setIsSaving] = useState(false)
  const resourceLimits = useResourceLimitBounds(true)
  const inheritedPermissions = useMemo(
    () => getPermissionInheritanceMap(groups, draft.groupIds, draft.role),
    [draft.groupIds, draft.role, groups]
  )

  const updateDraft = (patch: Partial<UserDraft>) => {
    setDraft(current => ({ ...current, ...patch }))
  }

  const saveUser = async () => {
    setIsSaving(true)
    try {
      unwrapActionResult(await updateUserAction(user.id, buildUserUpdateInput(draft)))
      toast({ title: 'User saved' })
      router.refresh()
    } catch (error) {
      toast({
        title: 'Could not save user',
        description: getDisplayErrorMessage(error),
        variant: 'danger'
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <StandardPage className='gap-2'>
      <PageBackdrop
        imageSrc={draft.avatarDataUrl}
        opacity={0.08}
      />
      <PageHeader
        breadcrumbs={[
          { label: 'Users', href: '/security/users' },
          { label: 'Users', href: '/security/users' },
          { label: user.username }
        ]}
        title={draft.name || draft.username}
        titlePrefix={
          <Avatar className='size-12 max-sm:size-10'>
            <AvatarImage src={draft.avatarDataUrl ?? ''} />
            <AvatarFallback
              style={{
                backgroundColor: getHslColorFromCharCode(draft.name),
                color: getHslColorFromCharCodeForeground(draft.name)
              }}
            >
              {draft.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        }
        description='Account settings, quotas, groups, and permissions.'
        actions={
          <>
            {user.passwordChangeRequired ? <Badge variant='warning'>Password change required</Badge> : null}
            <Label className='flex items-center gap-2 cursor-pointer select-none font-normal'>
              Active Account
              <Switch
                checked={!draft.disabled}
                onCheckedChange={checked => updateDraft({ disabled: !checked })}
              />
            </Label>
            <Button
              disabled={isSaving}
              onClick={() => void saveUser()}
            >
              <IconDeviceFloppy className='size-4' />
              Save User
            </Button>
          </>
        }
      />
      <section className='grid w-full gap-6 px-6 pb-16 max-sm:px-4 xl:grid-cols-[minmax(0,1fr)_minmax(28rem,0.85fr)]'>
        <div className='grid content-start gap-6'>
          <Section
            title='Account'
            surface='panel'
            titleClassName='pb-4'
            contentClassName='gap-5'
          >
            <UserAvatarInput
              name={draft.name || draft.username}
              avatar={draft.avatarDataUrl}
              onChange={avatarDataUrl => updateDraft({ avatarDataUrl })}
            />
            <div className='grid gap-4 md:grid-cols-2'>
              <FormField
                label='Username'
                required
              >
                <Input
                  value={draft.username}
                  required
                  aria-required='true'
                  onChange={event => updateDraft({ username: event.target.value })}
                />
              </FormField>
              <FormField label='Display Name'>
                <Input
                  value={draft.name}
                  onChange={event => updateDraft({ name: event.target.value })}
                />
              </FormField>
              <FormField label='New Password'>
                <div className='grid gap-2'>
                  <Input
                    value={draft.password}
                    type='password'
                    placeholder='Leave empty to keep current password'
                    onChange={event => updateDraft({ password: event.target.value })}
                  />
                  <p className='text-xs text-foreground-muted'>Password resets require a change on next login.</p>
                </div>
              </FormField>
              <FormField
                label='Role'
                required
              >
                <Select
                  value={draft.role}
                  onValueChange={value => updateDraft({ role: toUserRole(value) })}
                >
                  <SelectTrigger>
                    <SelectValue className='w-auto' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='user'>User</SelectItem>
                    <SelectItem value='admin'>Admin</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
            </div>
            {/* <FormField
              label='Active Account'
              description='Disabled users cannot sign in and their future actions are denied.'
              className='rounded-panel bg-surface-band/55 px-4 py-3'
            >
              <Switch
                checked={!draft.disabled}
                onCheckedChange={checked => updateDraft({ disabled: !checked })}
              />
            </FormField> */}
          </Section>
          <Section
            title='Groups'
            surface='panel'
            titleClassName='pb-4'
            contentClassName='gap-5'
          >
            <GroupMembershipPicker
              groups={groups}
              selectedGroupIds={draft.groupIds}
              onChange={groupIds => updateDraft({ groupIds })}
            />
          </Section>
          <Section
            title='Quotas'
            surface='panel'
            titleClassName='pb-4'
            contentClassName='gap-5'
          >
            <QuotaFields
              quotas={draft.quotas}
              resourceLimits={resourceLimits}
              onChange={quotas => updateDraft({ quotas })}
            />
          </Section>
        </div>
        <Section
          title={
            <div>
              <div>Permissions</div>
              <p className='mt-1 text-sm font-normal text-foreground-muted'>
                Group permissions are inherited. Toggling a permission here creates a user-level override.
              </p>
            </div>
          }
          surface='panel'
          titleClassName='pb-4'
          contentClassName='gap-4'
          className='xl:sticky xl:top-4'
        >
          <PermissionSwitchTable
            permissions={draft.permissionOverrides}
            inheritedPermissions={inheritedPermissions}
            onChange={permissionOverrides => updateDraft({ permissionOverrides })}
          />
        </Section>
      </section>
    </StandardPage>
  )
}
