'use client'

import { useState } from 'react'
import { IconTrash } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Section } from '@/components/ui/section'
import { PageBreadcrumbs } from '@/features/shell/components/page-breadcrumbs'
import { ProtectedStackPageLayout } from '@/features/shell/components/protected-page-shell'
import { toast } from '@/hooks/use-toast'
import { deleteUserAction } from '@/server/users/actions/delete-user-action'
import { setUserDisabledAction } from '@/server/users/actions/set-user-disabled-action'
import { CreateUserDialog } from './components/create-user-dialog'
import { UsersGrid } from './components/users-grid'
import type { PublicUser, UserGroup } from '@/server/auth/user'

export const UsersSettings = ({
  initialUsers,
  initialGroups
}: {
  initialUsers: PublicUser[]
  initialGroups: UserGroup[]
}) => {
  const [users, setUsers] = useState(initialUsers)
  const groups = initialGroups
  const [busyUserId, setBusyUserId] = useState<string | null>(null)
  const [pendingDeleteUser, setPendingDeleteUser] = useState<PublicUser | null>(null)

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
      const updated = await setUserDisabledAction(user.id, !user.disabled)
      upsertUser(updated)
      toast({ title: updated.disabled ? 'User disabled' : 'User enabled' })
    } catch (error) {
      toast({
        title: 'Could not update user',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
    } finally {
      setBusyUserId(null)
    }
  }

  const deleteUser = async (id: string) => {
    setBusyUserId(id)
    try {
      await deleteUserAction(id)
      setUsers(current => current.filter(user => user.id !== id))
      setPendingDeleteUser(null)
      toast({ title: 'User deleted' })
    } catch (error) {
      toast({
        title: 'Could not delete user',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
    } finally {
      setBusyUserId(null)
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
            { label: 'Users' }
          ]}
        />
        <div className='flex items-center justify-between gap-3 pt-4'>
          <h2 className='text-3xl font-medium max-sm:text-xl'>Users</h2>
          <CreateUserDialog
            groups={groups}
            onCreated={upsertUser}
          />
        </div>
      </section>
      <section className='flex w-full flex-col gap-6 px-6 pb-16 max-sm:px-4'>
        <Section
          title='Existing Users'
          titleClassName='pb-2'
          contentClassName='gap-3'
        >
          <UsersGrid
            users={users}
            groups={groups}
            busyUserId={busyUserId}
            onToggleDisabled={user => void toggleDisabled(user)}
            onDelete={setPendingDeleteUser}
          />
        </Section>
      </section>
      <Dialog
        modal
        open={Boolean(pendingDeleteUser)}
        onOpenChange={isOpen => {
          if (!isOpen) {
            setPendingDeleteUser(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {pendingDeleteUser?.username}?</DialogTitle>
            <DialogDescription>
              This removes the user account from the web app user store. Existing orchestrator deployments are not
              deleted by this action.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant='destructive'
              disabled={!pendingDeleteUser || busyUserId === pendingDeleteUser.id}
              onClick={() => {
                if (pendingDeleteUser) {
                  void deleteUser(pendingDeleteUser.id)
                }
              }}
            >
              <IconTrash className='size-4' />
              Delete User
            </Button>
            <DialogClose asChild>
              <Button variant='secondary'>Cancel</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ProtectedStackPageLayout>
  )
}
