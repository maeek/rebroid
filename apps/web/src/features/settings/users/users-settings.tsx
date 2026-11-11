'use client'

import { useRef, useState } from 'react'
import { ConfirmMutationDialog } from '@/components/ui/confirm-mutation-dialog'
import { toast } from '@/hooks/use-toast'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { deleteUserAction } from '@/server/users/actions/delete-user-action'
import { setUserDisabledAction } from '@/server/users/actions/set-user-disabled-action'
import { unwrapActionResult } from '@/shared/actions/action-result'
import { PageHeader } from '@/shared/ui/page/page-header'
import { StandardPage } from '@/shared/ui/page/page-layout'
import { CreateUserDialog } from './components/create-user-dialog'
import { PasswordPolicyDialog } from './components/password-policy-dialog'
import { UsersGrid } from './components/users-grid'
import type { PublicUser, UserGroup } from '@/shared/contracts/auth-user'

export const UsersSettings = ({
  initialUsers,
  initialGroups,
  initialPasswordMinimumLength,
  loading = false
}: {
  loading?: boolean
  initialUsers: PublicUser[]
  initialGroups: UserGroup[]
  initialPasswordMinimumLength: number
}) => {
  const [users, setUsers] = useState(initialUsers)
  const groups = initialGroups
  const [busyUserId, setBusyUserId] = useState<string | null>(null)
  const [pendingDisableUsers, setPendingDisableUsers] = useState<PublicUser[]>([])
  const lastUserActionRef = useRef<HTMLElement | null>(null)
  const [pendingDeleteUser, setPendingDeleteUser] = useState<PublicUser | null>(null)
  const [pendingDeleteUsers, setPendingDeleteUsers] = useState<PublicUser[]>([])

  const upsertUser = (user: PublicUser) => {
    setUsers(current => {
      if (current.some(item => item.id === user.id)) {
        return current.map(item => (item.id === user.id ? user : item))
      }

      return [user, ...current]
    })
  }

  const requestDisableUsers = (targets: PublicUser[]) => {
    setPendingDisableUsers(targets.filter(user => !user.disabled))
  }

  const deleteUser = async (id: string) => {
    setBusyUserId(id)
    try {
      unwrapActionResult(await deleteUserAction(id))
      setUsers(current => current.filter(user => user.id !== id))
      setPendingDeleteUser(null)
      toast({ title: 'User deleted', variant: 'success' })
    } catch (error) {
      toast({
        title: 'Could not delete user',
        description: getDisplayErrorMessage(error),
        variant: 'danger'
      })
    } finally {
      setBusyUserId(null)
    }
  }

  const setUsersDisabled = async (targets: PublicUser[], disabled: boolean) => {
    const changedUsers = targets.filter(user => user.disabled !== disabled)
    if (changedUsers.length === 0) return
    setBusyUserId(changedUsers.length === 1 ? changedUsers[0].id : 'bulk')
    try {
      const results = await Promise.all(changedUsers.map(user => setUserDisabledAction(user.id, disabled)))
      const updatedUsers = results
        .map(result => (result.ok ? result.data : null))
        .filter((user): user is PublicUser => Boolean(user))
      setUsers(current => current.map(user => updatedUsers.find(updated => updated.id === user.id) ?? user))
      if (disabled) setPendingDisableUsers(changedUsers.filter((_, index) => !results[index].ok))
      const failedCount = results.length - updatedUsers.length
      const firstError = results.find(result => !result.ok)?.error.message
      let successTitle = disabled ? 'Selected users disabled' : 'Selected users enabled'
      if (changedUsers.length === 1) successTitle = disabled ? 'User disabled' : 'User enabled'
      toast(
        failedCount > 0
          ? {
              title: 'Some users could not be updated',
              description: firstError ?? `${failedCount} update request${failedCount === 1 ? '' : 's'} failed.`,
              variant: 'danger'
            }
          : { title: successTitle, variant: 'success' }
      )
    } catch (error) {
      toast({ title: 'Could not update users', description: getDisplayErrorMessage(error), variant: 'danger' })
    } finally {
      setBusyUserId(null)
    }
  }

  const deleteUsers = async (targets: PublicUser[]) => {
    if (targets.length === 0) return
    setBusyUserId('bulk')
    try {
      const results = await Promise.all(targets.map(user => deleteUserAction(user.id)))
      const deletedIds = new Set(
        results
          .map((result, index) => (result.ok ? targets[index]?.id : null))
          .filter((id): id is string => Boolean(id))
      )
      setUsers(current => current.filter(user => !deletedIds.has(user.id)))
      setPendingDeleteUsers([])
      const failedCount = results.length - deletedIds.size
      const firstError = results.find(result => !result.ok)?.error.message
      toast(
        failedCount > 0
          ? {
              title: 'Some users could not be deleted',
              description: firstError ?? `${failedCount} delete request${failedCount === 1 ? '' : 's'} failed.`,
              variant: 'danger'
            }
          : { title: 'Selected users deleted', variant: 'success' }
      )
    } finally {
      setBusyUserId(null)
    }
  }

  return (
    <StandardPage
      gridToolbar
      className='gap-2'
    >
      <PageHeader
        section={{ label: 'Security' }}
        title='Users'
        actions={
          <>
            <PasswordPolicyDialog
              initialPasswordMinimumLength={initialPasswordMinimumLength}
              disabled={loading}
            />
            <CreateUserDialog
              disabled={loading}
              groups={groups}
              onCreated={upsertUser}
            />
          </>
        }
      />
      <section
        aria-label='User list'
        className='flex w-full flex-col gap-6 px-6 pb-16 max-sm:px-4'
        onFocusCapture={event => {
          if (event.currentTarget.contains(event.target)) lastUserActionRef.current = event.target
        }}
      >
        <UsersGrid
          loading={loading}
          users={users}
          groups={groups}
          busyUserId={busyUserId}
          onDisable={user => requestDisableUsers([user])}
          onEnable={user => void setUsersDisabled([user], false)}
          onDelete={setPendingDeleteUser}
          onDeleteSelected={setPendingDeleteUsers}
          onDisableSelected={requestDisableUsers}
          onEnableSelected={targets => void setUsersDisabled(targets, false)}
        />
      </section>
      <ConfirmMutationDialog
        open={pendingDisableUsers.length > 0}
        finalFocus={lastUserActionRef}
        title={
          pendingDisableUsers.length === 1
            ? `Disable ${pendingDisableUsers[0].name}?`
            : `Disable ${pendingDisableUsers.length} users?`
        }
        description='Disabling access signs users out and prevents new sign-ins. You can enable them again later.'
        summary={
          <span>
            {pendingDisableUsers
              .slice(0, 5)
              .map(user => user.username)
              .join(', ')}
            {pendingDisableUsers.length > 5 ? ` and ${pendingDisableUsers.length - 5} more` : null}
          </span>
        }
        confirmLabel={pendingDisableUsers.length === 1 ? 'Disable user' : 'Disable users'}
        tone='warning'
        pending={busyUserId !== null}
        pendingLabel='Disabling…'
        confirmDisabled={pendingDisableUsers.length === 0}
        onConfirm={() => void setUsersDisabled(pendingDisableUsers, true)}
        onOpenChange={isOpen => {
          if (!isOpen) setPendingDisableUsers([])
        }}
      />
      <ConfirmMutationDialog
        open={Boolean(pendingDeleteUser)}
        title={`Delete ${pendingDeleteUser?.username ?? 'user'}?`}
        description='This removes the user account from the web app user store.'
        consequence='Existing orchestrator deployments are not deleted by this action.'
        confirmLabel='Delete user'
        pending={Boolean(pendingDeleteUser && busyUserId === pendingDeleteUser.id)}
        pendingLabel='Deleting…'
        confirmDisabled={!pendingDeleteUser}
        onConfirm={() => {
          if (pendingDeleteUser) void deleteUser(pendingDeleteUser.id)
        }}
        onOpenChange={isOpen => {
          if (!isOpen) setPendingDeleteUser(null)
        }}
      />
      <ConfirmMutationDialog
        open={pendingDeleteUsers.length > 0}
        title={`Delete ${pendingDeleteUsers.length} selected users?`}
        description='This removes the selected user accounts from the web app user store.'
        consequence='Existing orchestrator deployments are not deleted by this action.'
        confirmLabel='Delete users'
        pending={busyUserId === 'bulk'}
        pendingLabel='Deleting…'
        confirmDisabled={pendingDeleteUsers.length === 0}
        onConfirm={() => void deleteUsers(pendingDeleteUsers)}
        onOpenChange={isOpen => {
          if (!isOpen) setPendingDeleteUsers([])
        }}
      />
    </StandardPage>
  )
}
