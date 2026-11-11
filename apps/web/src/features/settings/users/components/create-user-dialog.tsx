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
import { MutationButton } from '@/components/ui/mutation-button'
import { toast } from '@/hooks/use-toast'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { createUserAction } from '@/server/users/actions/create-user-action'
import { unwrapActionResult } from '@/shared/actions/action-result'
import { defaultUserGroupId } from '@/shared/permissions/effective-access'
import { GroupMembershipPicker } from './group-membership-picker'
import { useCreateDialog } from './use-create-dialog'
import type { PublicUser, UserGroup } from '@/shared/contracts/auth-user'

export const CreateUserDialog = ({
  groups,
  onCreated,
  disabled = false
}: {
  disabled?: boolean
  groups: UserGroup[]
  onCreated: (user: PublicUser) => void
}) => {
  const { open, setOpen } = useCreateDialog(disabled)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [groupIds, setGroupIds] = useState(() =>
    groups.some(group => group.id === defaultUserGroupId) ? [defaultUserGroupId] : []
  )
  const [isSaving, setIsSaving] = useState(false)

  const createUser = async () => {
    setIsSaving(true)
    try {
      const user = unwrapActionResult(await createUserAction({ username, password, groupIds }))
      onCreated(user)
      setUsername('')
      setPassword('')
      setGroupIds([defaultUserGroupId])
      setOpen(false)
      toast({ title: 'User created', variant: 'success' })
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
        <Button
          size='sm'
          disabled={disabled}
        >
          <IconPlus className='size-4' />
          New user
        </Button>
      </DialogTrigger>
      <DialogContent
        data-editor-dialog=''
        className='sm:max-w-2xl'
      >
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
            label='Groups'
            layout='vertical'
            required
          >
            <GroupMembershipPicker
              groups={groups}
              selectedGroupIds={groupIds}
              onChange={setGroupIds}
            />
          </FormField>
        </div>
        <DialogFooter>
          <MutationButton
            pending={isSaving}
            pendingLabel='Creating…'
            disabled={!username.trim() || !password || groupIds.length === 0}
            onClick={() => void createUser()}
          >
            Create User
          </MutationButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
