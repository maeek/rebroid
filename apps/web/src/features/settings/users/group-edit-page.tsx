'use client'

import { useState } from 'react'
import { IconDeviceFloppy } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { FieldChangesProvider, fieldValuesEqual } from '@/components/ui/field-changes'
import { MutationButton } from '@/components/ui/mutation-button'
import { useSaveFeedback } from '@/hooks/use-save-feedback'
import { toast } from '@/hooks/use-toast'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { updateUserGroupAction } from '@/server/users/actions/update-user-group-action'
import { unwrapActionResult } from '@/shared/actions/action-result'
import { useResourceLimitBounds } from '@/shared/model/settings/use-resource-limit-bounds'
import { administratorsGroupId, resolveEffectiveAccess } from '@/shared/permissions/effective-access'
import { EditorPage } from '@/shared/ui/page/editor-page'
import { CompactPageHeader } from '@/shared/ui/page/page-header'
import { PageContent } from '@/shared/ui/page/page-layout'
import { StateView } from '@/shared/ui/state-view'
import { UnsavedChangesGuard } from '@/shared/ui/unsaved-changes-dialog'
import { AccessEditorLayout } from './components/access-editor-layout'
import { GroupDetailsSections } from './components/identity-fields'
import { PermissionEditor } from './components/permission-editor'
import { QuotaFields } from './components/quota-fields'
import { buildGroupUpdateInput, toGroupDraft, type GroupDraft } from './group-edit-page-model'
import type { UserGroup } from '@/shared/contracts/auth-user'

export const GroupEditPage = ({ group }: { group: UserGroup }) => {
  const router = useRouter()
  const [draft, setDraft] = useState(() => toGroupDraft(group))
  const [savedDraft, setSavedDraft] = useState(() => toGroupDraft(group))
  const [isSaving, setIsSaving] = useState(false)
  const saveFeedback = useSaveFeedback(JSON.stringify(draft))
  const resourceLimits = useResourceLimitBounds(true)

  const updateDraft = (patch: Partial<GroupDraft>) => {
    setDraft(current => ({ ...current, ...patch }))
  }

  const saveGroup = async () => {
    saveFeedback.resetSaveFeedback()
    setIsSaving(true)
    try {
      const saved = unwrapActionResult(await updateUserGroupAction(group.id, buildGroupUpdateInput(draft)))
      const next = toGroupDraft(saved)
      setDraft(next)
      setSavedDraft(next)
      saveFeedback.confirmSaved(JSON.stringify(next))
      toast({ title: 'Group saved', variant: 'success' })
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
    <FieldChangesProvider
      value={draft}
      baseline={savedDraft}
    >
      <EditorPage className='gap-2'>
        <CompactPageHeader
          inlineActions
          section={{ label: 'Users & groups' }}
          trail={[{ label: 'Groups', href: '/security/groups' }]}
          breadcrumbLabel={group.name}
          title={draft.name || group.name}
          description='Default permissions and quotas for group members.'
          actions={
            <MutationButton
              pending={isSaving}
              pendingLabel='Saving…'
              success={saveFeedback.saved}
              onClick={() => void saveGroup()}
            >
              <IconDeviceFloppy className='size-4' />
              Save Group
            </MutationButton>
          }
        />
        <PageContent>
          <fieldset
            disabled={isSaving}
            className='min-w-0'
            aria-busy={isSaving}
          >
            <AccessEditorLayout
              identity={
                <GroupDetailsSections
                  disabled={isSaving}
                  draft={draft}
                  onChange={updateDraft}
                />
              }
              permissions={
                <PermissionEditor
                  permissions={draft.permissions}
                  disabled={isSaving}
                  onChange={
                    group.id === administratorsGroupId ? undefined : permissions => updateDraft({ permissions })
                  }
                  decisions={
                    group.id === administratorsGroupId
                      ? resolveEffectiveAccess([group], [group.id]).decisions
                      : undefined
                  }
                />
              }
              quotasDescription={
                group.id === administratorsGroupId ? 'Resource limits for applications and sessions.' : undefined
              }
              quotas={
                group.id === administratorsGroupId ? (
                  <StateView
                    kind='not-applicable'
                    title='Unlimited quotas'
                    description='Administrators have unlimited quotas. Group resource limits do not restrict administrator users.'
                  />
                ) : (
                  <QuotaFields
                    quotas={draft.quotas}
                    resourceLimits={resourceLimits}
                    onChange={quotas => updateDraft({ quotas })}
                  />
                )
              }
            />
          </fieldset>
        </PageContent>
      </EditorPage>
      <UnsavedChangesGuard
        dirty={!fieldValuesEqual(draft, savedDraft)}
        onDiscard={() => setDraft(savedDraft)}
      />
    </FieldChangesProvider>
  )
}
