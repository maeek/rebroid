'use client'

import { useState } from 'react'
import { IconPlus } from '@tabler/icons-react'
import { Badge } from '@/components/ui/badge'
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
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/hooks/use-toast'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { createUserAction } from '@/server/users/actions/create-user-action'
import { unwrapActionResult } from '@/shared/actions/action-result'
import { GroupMembershipPicker } from './group-membership-picker'
import type { PublicUser, UserGroup, UserRole } from '@/shared/contracts/auth-user'

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
      const user = unwrapActionResult(await createUserAction({ username, password, role, groupIds }))
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
        description: getDisplayErrorMessage(error),
        variant: 'danger'
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
        <Button size='sm'>
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
          <FormField
            controlId='create-user-username'
            label='Username'
            layout='vertical'
            required
          >
            <Input
              value={username}
              required
              aria-required='true'
              autoComplete='username'
              placeholder='admin'
              onChange={event => setUsername(event.target.value)}
            />
          </FormField>
          <FormField
            controlId='create-user-password'
            label='Temporary Password'
            layout='vertical'
            description={
              <span className='flex flex-wrap items-center gap-2'>
                <Badge variant='warning'>Change required</Badge>
                The user must set a new password on first login.
              </span>
            }
            required
          >
            <Input
              value={password}
              type='password'
              required
              aria-required='true'
              autoComplete='new-password'
              placeholder='Minimum 1 character'
              onChange={event => setPassword(event.target.value)}
            />
          </FormField>
          <FormField
            label='Role'
            layout='vertical'
            required
          >
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
          </FormField>
          <section className='grid gap-2'>
            <Label>
              Groups <span className='text-xs font-medium text-foreground-muted'>* (Required)</span>
            </Label>
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
