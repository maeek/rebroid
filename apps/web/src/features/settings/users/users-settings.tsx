'use client'

import { useState } from 'react'
import { ConfirmMutationDialog } from '@/components/ui/confirm-mutation-dialog'
import { Section } from '@/components/ui/section'
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
  initialPasswordMinimumLength
}: {
  initialUsers: PublicUser[]
  initialGroups: UserGroup[]
  initialPasswordMinimumLength: number
}) => {
  const [users, setUsers] = useState(initialUsers)
  const groups = initialGroups
  const [busyUserId, setBusyUserId] = useState<string | null>(null)
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

  const toggleDisabled = async (user: PublicUser) => {
    setBusyUserId(user.id)
    try {
      const updated = unwrapActionResult(await setUserDisabledAction(user.id, !user.disabled))
      upsertUser(updated)
      toast({ title: updated.disabled ? 'User disabled' : 'User enabled', variant: 'success' })
    } catch (error) {
      toast({
        title: 'Could not update user',
        description: getDisplayErrorMessage(error),
        variant: 'danger'
      })
    } finally {
      setBusyUserId(null)
    }
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
    if (targets.length === 0) return
    setBusyUserId('bulk')
    try {
      const results = await Promise.all(targets.map(user => setUserDisabledAction(user.id, disabled)))
      const updatedUsers = results
        .map(result => (result.ok ? result.data : null))
        .filter((user): user is PublicUser => Boolean(user))
      setUsers(current => current.map(user => updatedUsers.find(updated => updated.id === user.id) ?? user))
      const failedCount = results.length - updatedUsers.length
      const firstError = results.find(result => !result.ok)?.error.message
      toast(
        failedCount > 0
          ? {
              title: 'Some users could not be updated',
              description: firstError ?? `${failedCount} update request${failedCount === 1 ? '' : 's'} failed.`,
              variant: 'danger'
            }
          : { title: disabled ? 'Selected users disabled' : 'Selected users enabled', variant: 'success' }
      )
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
    <StandardPage className='gap-2'>
      <PageHeader
        section={{ label: 'Security' }}
        title='Users'
        actions={
          <>
            <PasswordPolicyDialog initialPasswordMinimumLength={initialPasswordMinimumLength} />
            <CreateUserDialog
              groups={groups}
              onCreated={upsertUser}
            />
          </>
        }
      />
      <section className='flex w-full flex-col gap-6 px-6 pb-16 max-sm:px-4'>
        <Section
          surface='plain'
          title='Existing Users'
          headingSpacing='default'
          contentClassName='gap-3'
        >
          <UsersGrid
            users={users}
            groups={groups}
            busyUserId={busyUserId}
            onToggleDisabled={user => void toggleDisabled(user)}
            onDelete={setPendingDeleteUser}
            onDeleteSelected={setPendingDeleteUsers}
            onDisableSelected={targets => void setUsersDisabled(targets, true)}
            onEnableSelected={targets => void setUsersDisabled(targets, false)}
          />
        </Section>
      </section>
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
