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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/hooks/use-toast'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { createUserAction } from '@/server/users/actions/create-user-action'
import { unwrapActionResult } from '@/shared/actions/action-result'
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
          <label className='grid gap-2'>
            <Label>
              Username <span className='text-xs font-medium text-muted-foreground'>* (Required)</span>
            </Label>
            <Input
              value={username}
              required
              aria-required='true'
              placeholder='admin'
              onChange={event => setUsername(event.target.value)}
            />
          </label>
          <label className='grid gap-2'>
            <Label>
              Temporary Password <span className='text-xs font-medium text-muted-foreground'>* (Required)</span>
            </Label>
            <Input
              value={password}
              type='password'
              required
              aria-required='true'
              placeholder='Minimum 1 character'
              onChange={event => setPassword(event.target.value)}
            />
            <div className='flex flex-wrap items-center gap-2 text-xs text-foreground-muted'>
              <Badge variant='warning'>Change required</Badge>
              The user must set a new password on first login.
            </div>
          </label>
          <div className='grid gap-3 sm:grid-cols-2'>
            <LabeledField
              label='Role'
              required
            >
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
            <Label>
              Groups <span className='text-xs font-medium text-muted-foreground'>* (Required)</span>
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
