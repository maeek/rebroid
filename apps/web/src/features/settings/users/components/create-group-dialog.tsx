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
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { MutationButton } from '@/components/ui/mutation-button'
import { Notice } from '@/components/ui/notice'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/hooks/use-toast'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { createUserGroupAction } from '@/server/users/actions/create-user-group-action'
import { unwrapActionResult } from '@/shared/actions/action-result'
import { useResourceLimitBounds } from '@/shared/model/settings/use-resource-limit-bounds'
import {
  defaultUserPermissions,
  defaultUserQuota,
  fullPermissions,
  unlimitedQuota
} from '@/shared/permissions/permissions'
import { PermissionSwitchTable } from './permission-switch-table'
import { QuotaFields } from './quota-fields'
import type { CreateUserGroupInput, UserGroup, UserRole } from '@/shared/contracts/auth-user'
import type { PermissionMap, ResourceQuota } from '@/shared/permissions/permissions'

export type CreateGroupDraft = {
  name: string
  description: string
  role: UserRole
  permissions: PermissionMap
  quotas: Partial<ResourceQuota>
}

const steps = ['Details', 'Quotas', 'Permissions'] as const

const getStepIndicatorClassName = (currentStep: number, itemStep: number) => {
  if (currentStep === itemStep) return 'h-1 rounded-full bg-primary'
  if (itemStep < currentStep) return 'h-1 rounded-full bg-success'
  return 'h-1 rounded-full bg-surface-band'
}

export const createInitialGroupDraft = (): CreateGroupDraft => ({
  name: '',
  description: '',
  role: 'user',
  permissions: { ...defaultUserPermissions },
  quotas: { ...defaultUserQuota }
})

export const buildCreateGroupInput = (draft: CreateGroupDraft): CreateUserGroupInput => ({
  name: draft.name,
  description: draft.description,
  role: draft.role,
  permissions: draft.role === 'admin' ? { ...fullPermissions } : draft.permissions,
  quotas: draft.role === 'admin' ? { ...unlimitedQuota } : draft.quotas
})

export const CreateGroupDialog = ({ onCreated }: { onCreated: (group: UserGroup) => void }) => {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState<CreateGroupDraft>(createInitialGroupDraft)
  const [isSaving, setIsSaving] = useState(false)
  const resourceLimits = useResourceLimitBounds(open)
  const isAdmin = draft.role === 'admin'

  const reset = () => {
    setStep(0)
    setDraft(createInitialGroupDraft())
  }

  const updateDraft = (patch: Partial<CreateGroupDraft>) => {
    setDraft(current => ({ ...current, ...patch }))
  }

  const createGroup = async () => {
    setIsSaving(true)
    try {
      const group = unwrapActionResult(await createUserGroupAction(buildCreateGroupInput(draft)))
      onCreated(group)
      setOpen(false)
      reset()
      toast({ title: 'Group created', variant: 'success' })
    } catch (error) {
      toast({
        title: 'Could not create group',
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
      onOpenChange={nextOpen => {
        if (isSaving) return
        setOpen(nextOpen)
        if (!nextOpen) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button size='sm'>
          <IconPlus className='size-4' />
          New group
        </Button>
      </DialogTrigger>
      <DialogContent className='flex max-h-[min(52rem,calc(100dvh-2rem))] flex-col sm:max-w-3xl'>
        <DialogHeader>
          <DialogTitle>Create group</DialogTitle>
          <DialogDescription>
            Set the role defaults, quotas, and permissions inherited by group members.
          </DialogDescription>
        </DialogHeader>

        <ol
          aria-label='Group creation progress'
          className='grid grid-cols-3 gap-2'
        >
          {steps.map((label, index) => (
            <li
              key={label}
              data-testid={`group-step-${index + 1}`}
              aria-current={step === index ? 'step' : undefined}
              className='grid gap-1'
            >
              <span className={getStepIndicatorClassName(step, index)} />
              <span
                className={step === index ? 'text-xs font-medium text-foreground' : 'text-xs text-foreground-muted'}
              >
                {index + 1}. {label}
              </span>
            </li>
          ))}
        </ol>

        <div className='min-h-0 flex-1 overflow-y-auto px-0.5 py-1'>
          {step === 0 ? (
            <div className='grid gap-5'>
              <div className='grid gap-4 md:grid-cols-2'>
                <FormField
                  label='Name'
                  layout='vertical'
                  required
                >
                  <Input
                    value={draft.name}
                    required
                    aria-required='true'
                    placeholder='Support operators'
                    onChange={event => updateDraft({ name: event.target.value })}
                  />
                </FormField>
                <FormField
                  label='Role'
                  layout='vertical'
                  description='The role supplies the initial access template.'
                  required
                >
                  <Select
                    value={draft.role}
                    onValueChange={value => updateDraft({ role: value === 'admin' ? 'admin' : 'user' })}
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
              </div>
              <FormField
                label='Description'
                layout='vertical'
                description='Optional context shown anywhere this group is selected.'
              >
                <Textarea
                  value={draft.description}
                  rows={4}
                  placeholder='Describe who should belong to this group.'
                  onChange={event => updateDraft({ description: event.target.value })}
                />
              </FormField>
            </div>
          ) : null}

          {step === 1 ? (
            <div className='grid gap-5'>
              {isAdmin ? (
                <Notice tone='info'>
                  Admin groups always have unlimited quotas. These values are locked because the server enforces them.
                </Notice>
              ) : (
                <QuotaFields
                  quotas={draft.quotas}
                  resourceLimits={resourceLimits}
                  onChange={quotas => updateDraft({ quotas })}
                />
              )}
            </div>
          ) : null}

          {step === 2 ? (
            <div className='grid gap-5'>
              {isAdmin ? (
                <Notice tone='info'>
                  Admin groups always receive every permission. These values are locked because the server enforces
                  them.
                </Notice>
              ) : (
                <PermissionSwitchTable
                  permissions={draft.permissions}
                  onChange={permissions => updateDraft({ permissions })}
                />
              )}
            </div>
          ) : null}
        </div>

        <DialogFooter className='border-t border-surface-border/55 pt-4 sm:justify-between'>
          <Button
            type='button'
            variant='secondary'
            disabled={isSaving || step === 0}
            onClick={() => setStep(current => Math.max(0, current - 1))}
          >
            Back
          </Button>
          <div className='flex justify-end gap-2'>
            {step < steps.length - 1 ? (
              <Button
                type='button'
                disabled={!draft.name.trim()}
                onClick={() => setStep(current => Math.min(steps.length - 1, current + 1))}
              >
                Next
              </Button>
            ) : (
              <MutationButton
                type='button'
                pending={isSaving}
                pendingLabel='Creating…'
                disabled={!draft.name.trim()}
                onClick={() => void createGroup()}
              >
                Create group
              </MutationButton>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
