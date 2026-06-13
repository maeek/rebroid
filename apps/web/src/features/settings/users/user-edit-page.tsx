'use client'

import { useMemo, useState } from 'react'
import { IconDeviceFloppy } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Section } from '@/components/ui/section'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/hooks/use-toast'
import { updateUserAction } from '@/server/users/actions/update-user-action'
import { useResourceLimitBounds } from '@/shared/model/settings/use-resource-limit-bounds'
import { PageBackdrop } from '@/shared/ui/page/page-backdrop'
import { PageBreadcrumbs } from '@/shared/ui/page/page-breadcrumbs'
import { ProtectedStackPageLayout } from '@/shared/ui/page/protected-page-shell'
import { UserAvatarInput } from '@/shared/ui/user-avatar/user-avatar-input'
import { getHslColorFromCharCode, getHslColorFromCharCodeForeground } from '@/utils/hsl-from-text'
import { GroupMembershipPicker } from './components/group-membership-picker'
import { LabeledField } from './components/labeled-field'
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
      await updateUserAction(user.id, buildUserUpdateInput(draft))
      toast({ title: 'User saved' })
      router.refresh()
    } catch (error) {
      toast({
        title: 'Could not save user',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <ProtectedStackPageLayout mainClassName='gap-2'>
      <PageBackdrop
        imageSrc={draft.avatarDataUrl}
        opacity={0.08}
      />
      <section className='shrink-0 px-6 py-4 max-sm:px-4'>
        <PageBreadcrumbs
          className='pt-0'
          items={[{ label: 'Users', href: '/users' }, { label: 'Users', href: '/users' }, { label: user.username }]}
        />
        <div className='flex items-center justify-between gap-3 pt-4 max-sm:flex-col max-sm:items-start'>
          <div className='flex min-w-0 items-center gap-4'>
            <Avatar className='size-12'>
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
            <div className='min-w-0'>
              <h2 className='truncate text-3xl font-medium max-sm:text-xl'>{draft.name || draft.username}</h2>
              <p className='text-sm text-foreground-muted'>Account settings, quotas, groups, and permissions.</p>
            </div>
          </div>
          <div className='flex gap-4 items-center'>
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
          </div>
        </div>
      </section>
      <section className='grid w-full gap-6 px-6 pb-16 max-sm:px-4 xl:grid-cols-[minmax(0,1fr)_minmax(28rem,0.85fr)]'>
        <div className='grid content-start gap-6'>
          <Section
            title='Account'
            boxed
            titleClassName='pb-4'
            contentClassName='gap-5'
          >
            <UserAvatarInput
              name={draft.name || draft.username}
              avatar={draft.avatarDataUrl}
              onChange={avatarDataUrl => updateDraft({ avatarDataUrl })}
            />
            <div className='grid gap-4 md:grid-cols-2'>
              <LabeledField
                label='Username'
                required
              >
                <Input
                  value={draft.username}
                  required
                  aria-required='true'
                  onChange={event => updateDraft({ username: event.target.value })}
                />
              </LabeledField>
              <LabeledField label='Display Name'>
                <Input
                  value={draft.name}
                  onChange={event => updateDraft({ name: event.target.value })}
                />
              </LabeledField>
              <LabeledField label='New Password'>
                <Input
                  value={draft.password}
                  type='password'
                  placeholder='Leave empty to keep current password'
                  onChange={event => updateDraft({ password: event.target.value })}
                />
              </LabeledField>
              <LabeledField
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
              </LabeledField>
            </div>
            {/* <Setting
              label='Active Account'
              description='Disabled users cannot sign in and their future actions are denied.'
              className='rounded-lg bg-surface-band/55 px-4 py-3'
            >
              <Switch
                checked={!draft.disabled}
                onCheckedChange={checked => updateDraft({ disabled: !checked })}
              />
            </Setting> */}
          </Section>
          <Section
            title='Groups'
            boxed
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
            boxed
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
          boxed
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
    </ProtectedStackPageLayout>
  )
}
