'use client'

import { useState } from 'react'
import { IconPlus } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/hooks/use-toast'
import { createUserAction } from '@/server/users/actions/create-user-action'
import { GroupMembershipPicker } from './group-membership-picker'
import { LabeledField } from './labeled-field'
import type { PublicUser, UserGroup, UserRole } from '@/server/auth/user'

export const CreateUserDialog = ({
  groups,
  onCreated
}: {
  groups: UserGroup[]
  onCreated: (user: PublicUser) => void
}) => {
  const [open, setOpen] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>('user')
  const [groupIds, setGroupIds] = useState([
    groups.find(group => group.role === 'user')?.id ?? groups[0]?.id ?? 'users'
  ])
  const [isSaving, setIsSaving] = useState(false)

  const createUser = async () => {
    setIsSaving(true)
    try {
      const user = await createUserAction({ username, password, role, groupIds })
      onCreated(user)
      setUsername('')
      setPassword('')
      setRole('user')
      setGroupIds([groups.find(group => group.role === 'user')?.id ?? groups[0]?.id ?? 'users'])
      setOpen(false)
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

  return (
    <Dialog
      modal
      open={open}
      onOpenChange={setOpen}
    >
      <DialogTrigger asChild>
        <Button>
          <IconPlus className='size-4' />
          New user
        </Button>
      </DialogTrigger>
      <DialogContent className='sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>Create User</DialogTitle>
          <DialogDescription>Create a username/password account and assign its groups.</DialogDescription>
        </DialogHeader>
        <div className='grid gap-4'>
          <label className='grid gap-2'>
            <Label>Username</Label>
            <Input
              value={username}
              placeholder='admin'
              onChange={event => setUsername(event.target.value)}
            />
          </label>
          <label className='grid gap-2'>
            <Label>Temporary Password</Label>
            <Input
              value={password}
              type='password'
              placeholder='Minimum 1 character'
              onChange={event => setPassword(event.target.value)}
            />
          </label>
          <div className='grid gap-3 sm:grid-cols-2'>
            <LabeledField label='Role'>
              <Select
                value={role}
                onValueChange={value => setRole(value === 'admin' ? 'admin' : 'user')}
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
          <section className='grid gap-2'>
            <Label>Groups</Label>
            <GroupMembershipPicker
              groups={groups}
              selectedGroupIds={groupIds}
              onChange={setGroupIds}
            />
          </section>
        </div>
        <DialogFooter>
          <Button
            disabled={isSaving}
            onClick={() => void createUser()}
          >
            Create User
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
