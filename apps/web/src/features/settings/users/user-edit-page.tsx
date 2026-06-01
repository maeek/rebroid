'use client'

import { useMemo, useState } from 'react'
import { IconDeviceFloppy } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useResourceLimitBounds } from '@/features/settings/hooks/use-resource-limit-bounds'
import { PageBreadcrumbs } from '@/features/shell/components/page-breadcrumbs'
import { ProtectedStackPageLayout } from '@/features/shell/components/protected-page-shell'
import { toast } from '@/hooks/use-toast'
import { updateUserAction } from '@/server/users/actions/update-user-action'
import { allPermissionIds, type PermissionMap, type ResourceQuota } from '@/shared/permissions/permissions'
import { getHslColorFromCharCode, getHslColorFromCharCodeForeground } from '@/utils/hsl-from-text'
import { PageBackdrop } from '../../shell/components/page-backdrop'
import { GroupMembershipPicker } from './components/group-membership-picker'
import { LabeledField } from './components/labeled-field'
import { PermissionSwitchTable, type PermissionInheritanceMap } from './components/permission-switch-table'
import { QuotaFields } from './components/quota-fields'
import { UserAvatarInput } from './components/user-avatar-input'
import type { PublicUser, UserGroup, UserRole } from '@/server/auth/user'

type UserDraft = {
  username: string
  name: string
  password: string
  role: UserRole
  groupIds: string[]
  disabled: boolean
  avatarDataUrl: string | null
  permissionOverrides: PermissionMap
  quotas: Partial<ResourceQuota>
}

const toDraft = (user: PublicUser): UserDraft => ({
  username: user.username,
  name: user.name,
  password: '',
  role: user.role,
  groupIds: user.groupIds,
  disabled: user.disabled,
  avatarDataUrl: user.avatarDataUrl,
  permissionOverrides: user.permissionOverrides,
  quotas: user.quotas
})

const getInheritanceMap = (groups: UserGroup[], groupIds: string[], role: UserRole): PermissionInheritanceMap => {
  const assignedGroups = groups.filter(group => groupIds.includes(group.id))

  return allPermissionIds.reduce<PermissionInheritanceMap>((inheritance, permissionId) => {
    const inheritedFrom = assignedGroups
      .filter(group => group.permissions[permissionId] === true)
      .map(group => group.name)

    if (role === 'admin' && inheritedFrom.length === 0) {
      inheritedFrom.push('Admin role')
    }

    if (inheritedFrom.length > 0) {
      inheritance[permissionId] = inheritedFrom
    }

    return inheritance
  }, {})
}

export const UserEditPage = ({ user, groups }: { user: PublicUser; groups: UserGroup[] }) => {
  const router = useRouter()
  const [draft, setDraft] = useState(() => toDraft(user))
  const [isSaving, setIsSaving] = useState(false)
  const resourceLimits = useResourceLimitBounds(true)
  const inheritedPermissions = useMemo(
    () => getInheritanceMap(groups, draft.groupIds, draft.role),
    [draft.groupIds, draft.role, groups]
  )

  const updateDraft = (patch: Partial<UserDraft>) => {
    setDraft(current => ({ ...current, ...patch }))
  }

  const saveUser = async () => {
    setIsSaving(true)
    try {
      await updateUserAction(user.id, {
        username: draft.username,
        name: draft.name,
        password: draft.password || undefined,
        role: draft.role,
        groupIds: draft.groupIds,
        disabled: draft.disabled,
        avatarDataUrl: draft.avatarDataUrl,
        permissionOverrides: draft.permissionOverrides,
        quotas: draft.quotas
      })
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
          items={[
            { label: 'Settings', href: '/settings/general' },
            { label: 'User management', href: '/settings/users' },
            { label: 'Users', href: '/settings/users' },
            { label: user.username }
          ]}
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
              <p className='text-sm text-secondary-foreground'>Account settings, quotas, groups, and permissions.</p>
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
          <section className='grid gap-5 rounded-lg border border-border/60 bg-card/35 p-6 backdrop-blur-md'>
            <h3 className='text-lg font-medium'>Account</h3>
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
                  onValueChange={value => updateDraft({ role: value === 'admin' ? 'admin' : 'user' })}
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
              className='rounded-lg bg-background/45 px-4 py-3'
            >
              <Switch
                checked={!draft.disabled}
                onCheckedChange={checked => updateDraft({ disabled: !checked })}
              />
            </Setting> */}
          </section>
          <section className='grid gap-5 rounded-lg border border-border/60 bg-card/35 p-6 backdrop-blur-md'>
            <h3 className='text-lg font-medium'>Groups</h3>
            <GroupMembershipPicker
              groups={groups}
              selectedGroupIds={draft.groupIds}
              onChange={groupIds => updateDraft({ groupIds })}
            />
          </section>
          <section className='grid gap-5 rounded-lg border border-border/60 bg-card/35 p-6 backdrop-blur-md'>
            <h3 className='text-lg font-medium'>Quotas</h3>
            <QuotaFields
              quotas={draft.quotas}
              resourceLimits={resourceLimits}
              onChange={quotas => updateDraft({ quotas })}
            />
          </section>
        </div>
        <section className='grid content-start gap-4 rounded-lg border border-border/60 bg-card/35 p-6 backdrop-blur-md xl:sticky xl:top-4'>
          <div>
            <h3 className='font-medium'>Permissions</h3>
            <p className='text-sm text-secondary-foreground'>
              Group permissions are inherited. Toggling a permission here creates a user-level override.
            </p>
          </div>
          <PermissionSwitchTable
            permissions={draft.permissionOverrides}
            inheritedPermissions={inheritedPermissions}
            onChange={permissionOverrides => updateDraft({ permissionOverrides })}
          />
        </section>
      </section>
    </ProtectedStackPageLayout>
  )
}
