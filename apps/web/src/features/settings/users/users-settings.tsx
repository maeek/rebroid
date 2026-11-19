'use client'

import { useRef, useState } from 'react'
import { ConfirmMutationDialog } from '@/components/ui/confirm-mutation-dialog'
import { toast } from '@/hooks/use-toast'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { deleteUserAction } from '@/server/users/actions/delete-user-action'
import { setUserDisabledAction } from '@/server/users/actions/set-user-disabled-action'
import { unwrapActionResult } from '@/shared/actions/action-result'
import { successfulBulkIds, summarizeBulkResults } from '@/shared/actions/bulk-action-results'
import { CompactPageHeader } from '@/shared/ui/page/page-header'
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [passwordMinimumLength, setPasswordMinimumLength] = useState(initialPasswordMinimumLength)
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
      const results = await Promise.allSettled(changedUsers.map(user => setUserDisabledAction(user.id, disabled)))
      const updatedUsers = new Map(
        results.flatMap(result => {
          if (result.status !== 'fulfilled' || !result.value.ok) return []
          const user = result.value.data
          return [[user.id, user] as const]
        })
      )
      setUsers(current => current.map(user => updatedUsers.get(user.id) ?? user))
      setSelectedIds(current => new Set([...current].filter(id => !updatedUsers.has(id))))
      if (disabled) {
        setPendingDisableUsers(changedUsers.filter(user => !updatedUsers.has(user.id)))
      }
      let successTitle = disabled ? 'Selected users disabled' : 'Selected users enabled'
      if (changedUsers.length === 1) successTitle = disabled ? 'User disabled' : 'User enabled'
      toast({ variant: 'success', ...summarizeBulkResults(results, successTitle, 'Some users could not be updated') })
    } finally {
      setBusyUserId(null)
    }
  }

  const deleteUsers = async (targets: PublicUser[]) => {
    if (targets.length === 0) return
    setBusyUserId('bulk')
    try {
      const results = await Promise.allSettled(targets.map(user => deleteUserAction(user.id)))
      const deletedIds = successfulBulkIds(targets, results)
      setUsers(current => current.filter(user => !deletedIds.has(user.id)))
      setSelectedIds(current => new Set([...current].filter(id => !deletedIds.has(id))))
      setPendingDeleteUsers([])
      toast({
        variant: 'success',
        ...summarizeBulkResults(results, 'Selected users deleted', 'Some users could not be deleted')
      })
    } finally {
      setBusyUserId(null)
    }
  }

  return (
    <StandardPage
      gridToolbar
      className='gap-2'
    >
      <CompactPageHeader
        section={{ label: 'Users & groups' }}
        title='Users'
        actions={
          <>
            <PasswordPolicyDialog
              initialPasswordMinimumLength={initialPasswordMinimumLength}
              onSaved={setPasswordMinimumLength}
              disabled={loading}
            />
            <CreateUserDialog
              disabled={loading}
              groups={groups}
              onCreated={upsertUser}
              passwordMinimumLength={passwordMinimumLength}
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
          selectedIds={selectedIds}
          setSelectedIds={setSelectedIds}
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
        details={
          pendingDisableUsers.length > 0
            ? {
                label: pendingDisableUsers.length === 1 ? 'Show username' : 'Show usernames',
                content: pendingDisableUsers.map(user => user.username).join(', ')
              }
            : undefined
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
        description='Rebroid removes the account and keeps its existing deployments.'
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
        description='Rebroid removes the selected accounts and keeps their existing deployments.'
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
