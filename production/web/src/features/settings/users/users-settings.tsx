'use client'

import { useState } from 'react'
import { IconKey, IconPlus, IconTrash } from '@tabler/icons-react'
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
import { Input } from '@/components/ui/input'
import { Section } from '@/components/ui/section'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PageBreadcrumbs } from '@/features/shell/components/page-breadcrumbs'
import { ProtectedStackPageLayout } from '@/features/shell/components/protected-page-shell'
import { toast } from '@/hooks/use-toast'
import { createUserAction } from '@/server/users/actions/create-user-action'
import { deleteUserAction } from '@/server/users/actions/delete-user-action'
import { resetUserPasswordAction } from '@/server/users/actions/reset-user-password-action'
import { setUserDisabledAction } from '@/server/users/actions/set-user-disabled-action'
import type { PublicUser, UserRole } from '@/server/auth/user'

type PasswordDrafts = Record<string, string>

export const UsersSettings = ({ initialUsers }: { initialUsers: PublicUser[] }) => {
  const [users, setUsers] = useState(initialUsers)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>('user')
  const [passwordDrafts, setPasswordDrafts] = useState<PasswordDrafts>({})
  const [busyUserId, setBusyUserId] = useState<string | null>(null)
  const [pendingDeleteUser, setPendingDeleteUser] = useState<PublicUser | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const createUser = async () => {
    setIsSaving(true)
    try {
      const user = await createUserAction({ username, password, role })
      setUsers(current => [user, ...current])
      setUsername('')
      setPassword('')
      setRole('user')
      toast({ title: 'User created' })
    } catch (error) {
      toast({
        title: 'Could not create user',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
    } finally {
      setIsSaving(false)
    }
  }

  const setDisabled = async (id: string, disabled: boolean) => {
    setBusyUserId(id)
    try {
      const user = await setUserDisabledAction(id, disabled)
      setUsers(current => current.map(item => (item.id === id ? user : item)))
      toast({ title: disabled ? 'User disabled' : 'User enabled' })
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

  const resetPassword = async (id: string) => {
    setBusyUserId(id)
    try {
      const user = await resetUserPasswordAction(id, passwordDrafts[id] ?? '')
      setUsers(current => current.map(item => (item.id === id ? user : item)))
      setPasswordDrafts(current => ({ ...current, [id]: '' }))
      toast({ title: 'Password reset' })
    } catch (error) {
      toast({
        title: 'Could not reset password',
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
      <section className='shrink-0 bg-background px-6 py-4 max-sm:px-4'>
        <PageBreadcrumbs
          className='pt-0'
          items={[{ label: 'Settings', href: '/settings/general' }, { label: 'Users' }]}
        />
        <h2 className='pt-4 text-3xl font-medium max-sm:text-xl'>Users</h2>
      </section>
      <section className='flex w-full flex-col gap-6 px-6 pb-16 max-sm:px-4'>
        <Section
          title='Create user'
          boxed
          titleClassName='pb-4'
          contentClassName='gap-4'
        >
          <div className='grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_12rem_auto]'>
            <Input
              value={username}
              placeholder='username'
              onChange={event => setUsername(event.target.value)}
            />
            <Input
              value={password}
              type='password'
              placeholder='password'
              onChange={event => setPassword(event.target.value)}
            />
            <Select
              value={role}
              onValueChange={value => setRole(value === 'admin' ? 'admin' : 'user')}
            >
              <SelectTrigger className='w-full'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='user'>User</SelectItem>
                <SelectItem value='admin'>Admin</SelectItem>
              </SelectContent>
            </Select>
            <Button
              className='max-md:w-full'
              disabled={isSaving}
              onClick={() => void createUser()}
            >
              <IconPlus className='size-4' />
              Create
            </Button>
          </div>
        </Section>
        <Section
          title='Existing users'
          boxed
          titleClassName='pb-4'
          contentClassName='gap-3'
        >
          <div className='hidden overflow-hidden rounded-lg border border-border/60 bg-background/25 lg:block'>
            <Table className='table-fixed'>
              <TableHeader className='bg-background/45'>
                <TableRow className='hover:bg-transparent'>
                  <TableHead className='px-4 py-3 uppercase'>User</TableHead>
                  <TableHead className='w-28 px-4 py-3 uppercase'>Role</TableHead>
                  <TableHead className='w-28 px-4 py-3 uppercase'>Status</TableHead>
                  <TableHead className='w-80 px-4 py-3 uppercase'>New password</TableHead>
                  <TableHead className='w-24 px-4 py-3 text-center uppercase'>Active</TableHead>
                  <TableHead className='w-50 px-4 py-3 text-right uppercase'>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map(user => (
                  <TableRow key={user.id}>
                    <TableCell className='px-4 py-3'>
                      <div className='min-w-0'>
                        <div className='font-medium'>{user.username}</div>
                        <div className='break-all text-xs text-muted-foreground'>{user.id}</div>
                      </div>
                    </TableCell>
                    <TableCell className='px-4 py-3 capitalize text-secondary-foreground'>{user.role}</TableCell>
                    <TableCell className={user.disabled ? 'px-4 py-3 text-destructive' : 'px-4 py-3 text-primary'}>
                      {user.disabled ? 'Disabled' : 'Active'}
                    </TableCell>
                    <TableCell className='px-4 py-3'>
                      <Input
                        value={passwordDrafts[user.id] ?? ''}
                        type='password'
                        placeholder='new password'
                        onChange={event =>
                          setPasswordDrafts(current => ({ ...current, [user.id]: event.target.value }))
                        }
                      />
                    </TableCell>
                    <TableCell className='px-4 py-3'>
                      <div className='flex justify-center'>
                        <Switch
                          checked={!user.disabled}
                          disabled={busyUserId === user.id}
                          onCheckedChange={checked => void setDisabled(user.id, !checked)}
                        />
                      </div>
                    </TableCell>
                    <TableCell className='px-4 py-3'>
                      <div className='flex justify-end gap-2'>
                        <Button
                          type='button'
                          variant='secondary'
                          disabled={busyUserId === user.id || !(passwordDrafts[user.id] ?? '').trim()}
                          onClick={() => void resetPassword(user.id)}
                        >
                          <IconKey className='size-4' />
                          Reset
                        </Button>
                        <Button
                          type='button'
                          variant='destructive'
                          disabled={busyUserId === user.id}
                          onClick={() => setPendingDeleteUser(user)}
                        >
                          <IconTrash className='size-4' />
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className='space-y-3 lg:hidden'>
            {users.map(user => (
              <div
                key={user.id}
                className='flex flex-col gap-4 rounded-lg border border-border/60 bg-background/25 p-4'
              >
                <div className='flex flex-wrap items-start justify-between gap-3'>
                  <div className='min-w-0'>
                    <div className='font-medium'>{user.username}</div>
                    <div className='break-all text-xs text-muted-foreground'>{user.id}</div>
                  </div>
                  <div
                    className={
                      user.disabled
                        ? 'rounded-full border border-destructive/35 bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive'
                        : 'rounded-full border border-primary/35 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary'
                    }
                  >
                    {user.disabled ? 'Disabled' : 'Active'}
                  </div>
                </div>
                <div className='grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end'>
                  <div className='space-y-1'>
                    <div className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>Role</div>
                    <div className='capitalize text-secondary-foreground'>{user.role}</div>
                  </div>
                  <div className='flex items-center justify-between rounded-md border border-border/60 bg-background/35 px-3 py-2 sm:min-w-32 sm:justify-center sm:gap-3'>
                    <span className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>Active</span>
                    <Switch
                      checked={!user.disabled}
                      disabled={busyUserId === user.id}
                      onCheckedChange={checked => void setDisabled(user.id, !checked)}
                    />
                  </div>
                </div>
                <div className='space-y-1'>
                  <div className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>New password</div>
                  <Input
                    value={passwordDrafts[user.id] ?? ''}
                    type='password'
                    placeholder='new password'
                    onChange={event => setPasswordDrafts(current => ({ ...current, [user.id]: event.target.value }))}
                  />
                </div>
                <div className='flex flex-col gap-2 sm:flex-row sm:justify-end'>
                  <Button
                    type='button'
                    variant='secondary'
                    className='sm:min-w-28'
                    disabled={busyUserId === user.id || !(passwordDrafts[user.id] ?? '').trim()}
                    onClick={() => void resetPassword(user.id)}
                  >
                    <IconKey className='size-4' />
                    Reset
                  </Button>
                  <Button
                    type='button'
                    variant='destructive'
                    className='sm:min-w-28'
                    disabled={busyUserId === user.id}
                    onClick={() => setPendingDeleteUser(user)}
                  >
                    <IconTrash className='size-4' />
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
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
              Delete user
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
