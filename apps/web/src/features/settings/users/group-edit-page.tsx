'use client'

import { useState } from 'react'
import { IconDeviceFloppy } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Section } from '@/components/ui/section'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/hooks/use-toast'
import { updateUserGroupAction } from '@/server/users/actions/update-user-group-action'
import { useResourceLimitBounds } from '@/shared/model/settings/use-resource-limit-bounds'
import { PageBreadcrumbs } from '@/shared/ui/page/page-breadcrumbs'
import { ProtectedStackPageLayout } from '@/shared/ui/page/protected-page-shell'
import { LabeledField } from './components/labeled-field'
import { PermissionSwitchTable } from './components/permission-switch-table'
import { QuotaFields } from './components/quota-fields'
import { buildGroupUpdateInput, toGroupDraft, type GroupDraft } from './group-edit-page-model'
import { toUserRole } from './user-edit-page-model'
import type { UserGroup } from '@/server/auth/user'

export const GroupEditPage = ({ group }: { group: UserGroup }) => {
  const router = useRouter()
  const [draft, setDraft] = useState(() => toGroupDraft(group))
  const [isSaving, setIsSaving] = useState(false)
  const resourceLimits = useResourceLimitBounds(true)

  const updateDraft = (patch: Partial<GroupDraft>) => {
    setDraft(current => ({ ...current, ...patch }))
  }

  const saveGroup = async () => {
    setIsSaving(true)
    try {
      await updateUserGroupAction(group.id, buildGroupUpdateInput(draft))
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
            { label: 'Users', href: '/users' },
            { label: 'Groups', href: '/users/groups' },
            { label: group.name }
          ]}
        />
        <div className='flex items-center justify-between gap-3 pt-4 max-sm:flex-col max-sm:items-start'>
          <div>
            <h2 className='text-3xl font-medium max-sm:text-xl'>{draft.name || group.name}</h2>
            <p className='text-sm text-foreground-muted'>Default permissions and quotas for group members.</p>
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
          <Section
            title='Group Details'
            boxed
            titleClassName='pb-4'
            contentClassName='gap-5'
          >
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
                  onValueChange={value => updateDraft({ role: toUserRole(value) })}
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
                These permissions are inherited by every group member.
              </p>
            </div>
          }
          boxed
          titleClassName='pb-4'
          contentClassName='gap-4'
          className='xl:sticky xl:top-4'
        >
          <PermissionSwitchTable
            permissions={draft.permissions}
            onChange={permissions => updateDraft({ permissions })}
          />
        </Section>
      </section>
    </ProtectedStackPageLayout>
  )
}
