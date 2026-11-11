'use client'

import { useMemo, useState } from 'react'
import { IconDeviceFloppy } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { MutationButton } from '@/components/ui/mutation-button'
import { toast } from '@/hooks/use-toast'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { updateUserAction } from '@/server/users/actions/update-user-action'
import { unwrapActionResult } from '@/shared/actions/action-result'
import { resolveEffectiveAccess } from '@/shared/permissions/effective-access'
import { EditorPage } from '@/shared/ui/page/editor-page'
import { PageBackdrop } from '@/shared/ui/page/page-backdrop'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent } from '@/shared/ui/page/page-layout'
import { getHslColorFromCharCode, getHslColorFromCharCodeForeground } from '@/utils/hsl-from-text'
import { AccessEditorLayout } from './components/access-editor-layout'
import { GroupMembershipEditor } from './components/group-membership-editor'
import { UserAccountSections } from './components/identity-fields'
import { PermissionEditor } from './components/permission-editor'
import { EffectiveQuotaFields } from './components/quota-fields'
import { buildUserUpdateInput, toUserDraft } from './user-edit-page-model'
import type { UserDraft } from './user-edit-page-model'
import type { PublicUser, UserGroup } from '@/shared/contracts/auth-user'

export const UserEditPage = ({ user, groups }: { user: PublicUser; groups: UserGroup[] }) => {
  const router = useRouter()
  const [draft, setDraft] = useState(() => toUserDraft(user))
  const [isSaving, setIsSaving] = useState(false)
  const [avatarPending, setAvatarPending] = useState(false)
  const busy = isSaving || avatarPending
  const effectiveAccess = useMemo(() => resolveEffectiveAccess(groups, draft.groupIds), [draft.groupIds, groups])

  const updateDraft = (patch: Partial<UserDraft>) => {
    setDraft(current => ({ ...current, ...patch }))
  }

  const saveUser = async () => {
    if (busy) return
    setIsSaving(true)
    try {
      unwrapActionResult(await updateUserAction(user.id, buildUserUpdateInput(draft)))
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
    <EditorPage className='gap-2'>
      <PageBackdrop
        imageSrc={draft.avatarDataUrl}
        opacity={0.08}
      />
      <PageHeader
        section={{ label: 'Security' }}
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
        description='Account settings, quotas, groups, and permissions.'
        actions={
          <>
            {user.passwordChangeRequired ? <Badge variant='warning'>Password change required</Badge> : null}
            <MutationButton
              pending={isSaving}
              pendingLabel='Saving…'
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
      </PageContent>
    </EditorPage>
  )
}
