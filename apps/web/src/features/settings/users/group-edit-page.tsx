'use client'

import { useState } from 'react'
import { IconDeviceFloppy } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Section } from '@/components/ui/section'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/hooks/use-toast'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { updateUserGroupAction } from '@/server/users/actions/update-user-group-action'
import { unwrapActionResult } from '@/shared/actions/action-result'
import { useResourceLimitBounds } from '@/shared/model/settings/use-resource-limit-bounds'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'
import { PermissionSwitchTable } from './components/permission-switch-table'
import { QuotaFields } from './components/quota-fields'
import { buildGroupUpdateInput, toGroupDraft, type GroupDraft } from './group-edit-page-model'
import { toUserRole } from './user-edit-page-model'
import type { UserGroup } from '@/shared/contracts/auth-user'

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
      unwrapActionResult(await updateUserGroupAction(group.id, buildGroupUpdateInput(draft)))
      toast({ title: 'Group saved' })
      router.refresh()
    } catch (error) {
      toast({
        title: 'Could not save group',
        description: getDisplayErrorMessage(error),
        variant: 'danger'
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <StandardPage className='gap-2'>
      <PageHeader
        section={{ label: 'Security' }}
        trail={[{ label: 'Groups', href: '/security/groups' }]}
        breadcrumbLabel={group.name}
        title={draft.name || group.name}
        description='Default permissions and quotas for group members.'
        actions={
          <Button
            disabled={isSaving}
            onClick={() => void saveGroup()}
          >
            <IconDeviceFloppy className='size-4' />
            Save Group
          </Button>
        }
      />
      <PageContent className='grid xl:grid-cols-[minmax(0,1fr)_minmax(28rem,0.85fr)]'>
        <div className='grid content-start gap-6'>
          <Section
            title='Group Details'
            surface='panel'
            titleClassName='pb-4'
            contentClassName='gap-5'
          >
            <div className='grid gap-4 md:grid-cols-2'>
              <FormField
                label='Name'
                required
                layout='vertical'
              >
                <Input
                  value={draft.name}
                  required
                  aria-required='true'
                  onChange={event => updateDraft({ name: event.target.value })}
                />
              </FormField>
              <FormField
                label='Role Template'
                required
                layout='vertical'
              >
                <Select
                  value={draft.role}
                  onValueChange={value => updateDraft({ role: toUserRole(value) })}
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='user'>User</SelectItem>
                    <SelectItem value='admin'>Admin</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
            </div>
            <FormField
              label='Description'
              layout='vertical'
            >
              <Textarea
                value={draft.description}
                rows={4}
                onChange={event => updateDraft({ description: event.target.value })}
              />
            </FormField>
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
                These permissions are inherited by every group member.
              </p>
            </div>
          }
          surface='panel'
          titleClassName='pb-4'
          contentClassName='gap-4'
          className='xl:sticky xl:top-4'
        >
          <PermissionSwitchTable
            permissions={draft.permissions}
            onChange={permissions => updateDraft({ permissions })}
          />
        </Section>
      </PageContent>
    </StandardPage>
  )
}
