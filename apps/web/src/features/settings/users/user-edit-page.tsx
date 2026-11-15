'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { IconDeviceFloppy } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { FieldChangesProvider, fieldValuesEqual } from '@/components/ui/field-changes'
import { MutationButton } from '@/components/ui/mutation-button'
import { useSaveFeedback } from '@/hooks/use-save-feedback'
import { toast } from '@/hooks/use-toast'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { updateUserAction } from '@/server/users/actions/update-user-action'
import { unwrapActionResult } from '@/shared/actions/action-result'
import { resolveEffectiveAccess } from '@/shared/permissions/effective-access'
import { EditorPage } from '@/shared/ui/page/editor-page'
import { CompactPageHeader } from '@/shared/ui/page/page-header'
import { PageContent } from '@/shared/ui/page/page-layout'
import { UnsavedChangesGuard } from '@/shared/ui/unsaved-changes-dialog'
import { getHslColorFromCharCode, getHslColorFromCharCodeForeground } from '@/utils/hsl-from-text'
import { AccessEditorLayout } from './components/access-editor-layout'
import { GroupMembershipEditor } from './components/group-membership-editor'
import { UserAccountSections } from './components/identity-fields'
import { PermissionEditor } from './components/permission-editor'
import { EffectiveQuotaFields } from './components/quota-fields'
import { buildUserUpdateInput, toUserDraft } from './user-edit-page-model'
import type { UserDraft } from './user-edit-page-model'
import type { PublicUser, UserGroup } from '@/shared/contracts/auth-user'

export const UserEditPage = ({
  user,
  groups,
  children
}: {
  user: PublicUser
  groups: UserGroup[]
  children?: ReactNode
}) => {
  const router = useRouter()
  const [draft, setDraft] = useState(() => toUserDraft(user))
  const [savedDraft, setSavedDraft] = useState(() => toUserDraft(user))
  const [isSaving, setIsSaving] = useState(false)
  const saveFeedback = useSaveFeedback(JSON.stringify(draft))
  const [avatarPending, setAvatarPending] = useState(false)
  const busy = isSaving || avatarPending
  const effectiveAccess = useMemo(() => resolveEffectiveAccess(groups, draft.groupIds), [draft.groupIds, groups])

  const updateDraft = (patch: Partial<UserDraft>) => {
    setDraft(current => ({ ...current, ...patch }))
  }

  const saveUser = async () => {
    if (busy) return
    saveFeedback.resetSaveFeedback()
    setIsSaving(true)
    try {
      const saved = unwrapActionResult(await updateUserAction(user.id, buildUserUpdateInput(draft)))
      const next = toUserDraft(saved)
      setDraft(next)
      setSavedDraft(next)
      saveFeedback.confirmSaved(JSON.stringify(next))
      toast({ title: 'User saved', variant: 'success' })
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
    <FieldChangesProvider
      value={draft}
      baseline={savedDraft}
    >
      <EditorPage className='gap-2'>
        <CompactPageHeader
          inlineActions
          section={{ label: 'Users & groups' }}
          trail={[{ label: 'Users', href: '/security/users' }]}
          breadcrumbLabel={user.username}
          title={draft.name || draft.username}
          leading={
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
          description={
            <>
              Account settings, quotas, groups, and permissions.
              {user.passwordChangeRequired ? (
                <span className='mt-2 block text-warning sm:hidden'>Password change required</span>
              ) : null}
            </>
          }
          actions={
            <>
              {user.passwordChangeRequired ? (
                <Badge
                  variant='warning'
                  className='max-sm:hidden'
                >
                  Password change required
                </Badge>
              ) : null}
              <MutationButton
                pending={isSaving}
                pendingLabel='Saving…'
                success={saveFeedback.saved}
                disabled={avatarPending}
                onClick={() => void saveUser()}
              >
                <IconDeviceFloppy className='size-4' />
                Save User
              </MutationButton>
            </>
          }
        />
        <PageContent>
          <fieldset
            disabled={busy}
            className='min-w-0'
            aria-busy={busy}
          >
            <AccessEditorLayout
              identity={
                <UserAccountSections
                  disabled={busy}
                  draft={draft}
                  onChange={updateDraft}
                  onAvatarPendingChange={setAvatarPending}
                />
              }
              access={
                <GroupMembershipEditor
                  groups={groups}
                  selectedGroupIds={draft.groupIds}
                  disabled={busy}
                  onChange={groupIds => updateDraft({ groupIds })}
                />
              }
              permissions={
                <PermissionEditor
                  decisions={effectiveAccess.decisions}
                  disabled={busy}
                />
              }
              quotasDescription='Effective limits from the selected groups.'
              quotas={<EffectiveQuotaFields quotas={effectiveAccess.quotas} />}
            />
          </fieldset>
          {children}
        </PageContent>
      </EditorPage>
      <UnsavedChangesGuard
        dirty={!fieldValuesEqual(draft, savedDraft)}
        onDiscard={() => setDraft(savedDraft)}
      />
    </FieldChangesProvider>
  )
}
