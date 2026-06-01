'use client'

import { useState } from 'react'
import { IconDeviceFloppy } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useResourceLimitBounds } from '@/features/settings/hooks/use-resource-limit-bounds'
import { PageBreadcrumbs } from '@/features/shell/components/page-breadcrumbs'
import { ProtectedStackPageLayout } from '@/features/shell/components/protected-page-shell'
import { toast } from '@/hooks/use-toast'
import { updateUserGroupAction } from '@/server/users/actions/update-user-group-action'
import { LabeledField } from './components/labeled-field'
import { PermissionSwitchTable } from './components/permission-switch-table'
import { QuotaFields } from './components/quota-fields'
import type { UserGroup, UserRole } from '@/server/auth/user'
import type { PermissionMap, ResourceQuota } from '@/shared/permissions/permissions'

type GroupDraft = {
  name: string
  description: string
  role: UserRole
  permissions: PermissionMap
  quotas: Partial<ResourceQuota>
}

const toDraft = (group: UserGroup): GroupDraft => ({
  name: group.name,
  description: group.description,
  role: group.role,
  permissions: group.permissions,
  quotas: group.quotas
})

export const GroupEditPage = ({ group }: { group: UserGroup }) => {
  const router = useRouter()
  const [draft, setDraft] = useState(() => toDraft(group))
  const [isSaving, setIsSaving] = useState(false)
  const resourceLimits = useResourceLimitBounds(true)

  const updateDraft = (patch: Partial<GroupDraft>) => {
    setDraft(current => ({ ...current, ...patch }))
  }

  const saveGroup = async () => {
    setIsSaving(true)
    try {
      await updateUserGroupAction(group.id, {
        name: draft.name,
        description: draft.description,
        role: draft.role,
        permissions: draft.permissions,
        quotas: draft.quotas
      })
      toast({ title: 'Group saved' })
      router.refresh()
    } catch (error) {
      toast({
        title: 'Could not save group',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <ProtectedStackPageLayout mainClassName='gap-2'>
      <section className='shrink-0 px-6 py-4 max-sm:px-4'>
        <PageBreadcrumbs
          className='pt-0'
          items={[
            { label: 'Settings', href: '/settings/general' },
            { label: 'User management', href: '/settings/users' },
            { label: 'Groups', href: '/settings/users/groups' },
            { label: group.name }
          ]}
        />
        <div className='flex items-center justify-between gap-3 pt-4 max-sm:flex-col max-sm:items-start'>
          <div>
            <h2 className='text-3xl font-medium max-sm:text-xl'>{draft.name || group.name}</h2>
            <p className='text-sm text-secondary-foreground'>Default permissions and quotas for group members.</p>
          </div>
          <Button
            disabled={isSaving}
            onClick={() => void saveGroup()}
          >
            <IconDeviceFloppy className='size-4' />
            Save Group
          </Button>
        </div>
      </section>
      <section className='grid w-full gap-6 px-6 pb-16 max-sm:px-4 xl:grid-cols-[minmax(0,1fr)_minmax(28rem,0.85fr)]'>
        <div className='grid content-start gap-6'>
          <section className='grid gap-5 rounded-lg border border-border/60 bg-card/35 p-6 backdrop-blur-md'>
            <h3 className='text-lg font-medium'>Group Details</h3>
            <div className='grid gap-4 md:grid-cols-2'>
              <LabeledField
                label='Name'
                required
              >
                <Input
                  value={draft.name}
                  required
                  aria-required='true'
                  onChange={event => updateDraft({ name: event.target.value })}
                />
              </LabeledField>
              <LabeledField
                label='Role Template'
                required
              >
                <Select
                  value={draft.role}
                  onValueChange={value => updateDraft({ role: value === 'admin' ? 'admin' : 'user' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='user'>User</SelectItem>
                    <SelectItem value='admin'>Admin</SelectItem>
                  </SelectContent>
                </Select>
              </LabeledField>
            </div>
            <LabeledField label='Description'>
              <Textarea
                value={draft.description}
                rows={4}
                onChange={event => updateDraft({ description: event.target.value })}
              />
            </LabeledField>
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
            <h3 className='text-lg font-medium'>Permissions</h3>
            <p className='text-sm text-secondary-foreground'>These permissions are inherited by every group member.</p>
          </div>
          <PermissionSwitchTable
            permissions={draft.permissions}
            onChange={permissions => updateDraft({ permissions })}
          />
        </section>
      </section>
    </ProtectedStackPageLayout>
  )
}
