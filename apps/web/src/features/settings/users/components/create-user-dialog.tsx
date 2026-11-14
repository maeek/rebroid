'use client'

import { useState } from 'react'
import { IconEye, IconEyeOff, IconPlus } from '@tabler/icons-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/ui/copy-button'
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

const passwordAlphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

export const CreateUserDialog = ({
  groups,
  onCreated,
  passwordMinimumLength,
  disabled = false
}: {
  disabled?: boolean
  groups: UserGroup[]
  onCreated: (user: PublicUser) => void
  passwordMinimumLength: number
}) => {
  const { open, setOpen } = useCreateDialog(disabled)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [groupIds, setGroupIds] = useState(() =>
    groups.some(group => group.id === defaultUserGroupId) ? [defaultUserGroupId] : []
  )
  const [isSaving, setIsSaving] = useState(false)
  const minimumLength = Math.max(1, passwordMinimumLength)
  const PasswordVisibilityIcon = passwordVisible ? IconEyeOff : IconEye

  const setDialogOpen = (nextOpen: boolean) => {
    if (!nextOpen) setPasswordVisible(false)
    setOpen(nextOpen)
  }

  const generatePassword = () => {
    const bytes = crypto.getRandomValues(new Uint8Array(Math.max(24, passwordMinimumLength)))
    setPassword(Array.from(bytes, byte => passwordAlphabet.charAt(byte % passwordAlphabet.length)).join(''))
  }

  const createUser = async () => {
    setIsSaving(true)
    try {
      const user = unwrapActionResult(await createUserAction({ username, password, groupIds }))
      onCreated(user)
      setUsername('')
      setPassword('')
      setGroupIds([defaultUserGroupId])
      setDialogOpen(false)
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
      onOpenChange={setDialogOpen}
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
            contentClassName='flex-row flex-wrap items-center gap-2'
            description={
              <span className='flex flex-wrap items-center gap-2'>
                <Badge variant='warning'>Change required</Badge>
                The user must set a new password on first login.
              </span>
            }
            required
          >
            <div className='relative min-w-36 flex-1'>
              <Input
                id='create-user-password'
                aria-describedby='create-user-password-description'
                className='pr-11 touch:pr-12'
                value={password}
                type={passwordVisible ? 'text' : 'password'}
                required
                aria-required='true'
                autoComplete='new-password'
                spellCheck={false}
                placeholder={`Minimum ${minimumLength} ${minimumLength === 1 ? 'character' : 'characters'}`}
                disabled={isSaving}
                onChange={event => setPassword(event.target.value)}
              />
              <Button
                type='button'
                variant='ghost'
                size='icon-sm'
                className='absolute inset-y-0 right-0.5 my-auto touch:right-0'
                aria-label={passwordVisible ? 'Hide temporary password' : 'Show temporary password'}
                aria-controls='create-user-password'
                onClick={() => setPasswordVisible(visible => !visible)}
              >
                <PasswordVisibilityIcon aria-hidden='true' />
              </Button>
            </div>
            <div className='flex items-center gap-1'>
              <Button
                type='button'
                variant='secondary'
                aria-label='Generate password'
                disabled={isSaving}
                onClick={generatePassword}
              >
                Generate
              </Button>
              <CopyButton
                iconOnly
                size='icon-md'
                aria-label='Copy temporary password'
                value={password}
                disabled={!password}
              />
            </div>
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
