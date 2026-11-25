'use client'

import { useRef, useState } from 'react'
import { isExternalAdbTcpNetwork, maxExternalAdbTcpEndpoints } from '@rebroid/android-application-core/android-device'
import { IconPlus } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { ConfirmMutationDialog } from '@/components/ui/confirm-mutation-dialog'
import {
  Dialog,
  DialogClose,
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
import { Section } from '@/components/ui/section'
import { Skeleton } from '@/components/ui/skeleton'
import { updateExternalTcpPolicyAction } from '@/server/orchestrator/external-devices/broker-actions'
import type { ExternalTcpPolicy } from '@/shared/contracts/external-device'

const deploymentListNote = 'This change saves the list in Rebroid and replaces the deployment defaults.'

export const AllowedEndpointsSection = ({ initialPolicy }: { initialPolicy?: ExternalTcpPolicy }) => {
  const [policy, setPolicy] = useState(initialPolicy)
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const [entry, setEntry] = useState('')
  const [fieldError, setFieldError] = useState('')
  const [mutationError, setMutationError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [pending, setPending] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const addTrigger = useRef<HTMLButtonElement>(null)
  const removeTrigger = useRef<HTMLButtonElement | null>(null)
  const fromDeployment = policy?.revision === 0

  const save = async (endpoints: string[], success: string) => {
    if (!policy || pending) return
    setPending(true)
    setMutationError('')
    setFeedback('')
    try {
      const result = await updateExternalTcpPolicyAction({ revision: policy.revision, endpoints })
      if (!result.ok) {
        setMutationError(`${result.error.message} Reference ${result.requestId}.`)
        return
      }
      setPolicy(result.data)
      setFeedback(success)
      setAdding(false)
      setRemoving(null)
    } catch {
      setMutationError('Could not update the allowlist. Try again.')
    } finally {
      setPending(false)
    }
  }

  const allowNetwork = () => {
    if (!policy || pending) return
    const network = entry.trim()
    let error = ''
    if (!isExternalAdbTcpNetwork(network)) error = 'Enter an IPv4 CIDR with a network address, such as 10.20.0.0/24.'
    else if (policy.endpoints.includes(network)) error = 'This network is already allowed.'
    else if (policy.endpoints.length >= maxExternalAdbTcpEndpoints)
      error = `You can add up to ${maxExternalAdbTcpEndpoints} allowlist entries.`
    if (error) {
      setFieldError(error)
      input.current?.focus()
      return
    }
    void save([...policy.endpoints, network], 'Network allowed.')
  }

  return (
    <>
      <Dialog
        open={adding}
        onOpenChange={(open, event) => {
          if (pending) {
            event.cancel()
            return
          }
          if (open) setMutationError('')
          setAdding(open)
        }}
        onOpenChangeComplete={open => {
          if (open) return
          setEntry('')
          setFieldError('')
        }}
      >
        <Section
          surface='panel'
          aria-label='TCP allowlist'
          title={
            <span
              id='allowed-endpoints'
              className='scroll-mt-6'
            >
              TCP allowlist
            </span>
          }
          description='Devices need an allowed address to use TCP ADB.'
          titleClassName='max-sm:flex-col max-sm:gap-3'
          actions={
            policy ? (
              <DialogTrigger asChild>
                <Button
                  ref={addTrigger}
                  disabled={pending}
                >
                  <IconPlus aria-hidden />
                  Allow network
                </Button>
              </DialogTrigger>
            ) : (
              <Skeleton className='h-9 w-32' />
            )
          }
          contentClassName='gap-3'
        >
          {!policy ? (
            <div className='flex items-center justify-between gap-4 border-t border-surface-border/60 pt-3'>
              <Skeleton className='h-4 w-36' />
              <Skeleton className='h-8 w-20' />
            </div>
          ) : policy.endpoints.length ? (
            <ul
              aria-label='TCP allowlist'
              className='divide-y divide-surface-border/60 border-t border-surface-border/60'
            >
              {policy.endpoints.map(endpoint => (
                <li
                  key={endpoint}
                  className='flex min-w-0 items-center justify-between gap-3 py-2'
                >
                  <code
                    className='min-w-0 text-sm tabular-nums [overflow-wrap:anywhere]'
                    translate='no'
                  >
                    {endpoint}
                  </code>
                  <Button
                    type='button'
                    variant='ghost'
                    size='sm'
                    aria-label={`Remove ${endpoint}`}
                    disabled={pending}
                    onClick={event => {
                      removeTrigger.current = event.currentTarget
                      setMutationError('')
                      setRemoving(endpoint)
                    }}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className='border-t border-surface-border/60 pt-3 text-sm text-foreground-muted'>
              No addresses are allowed yet.
            </p>
          )}
          {feedback ? <Notice tone='success'>{feedback}</Notice> : null}
        </Section>
        <DialogContent
          data-editor-dialog=''
          initialFocus={interaction => (interaction === 'touch' ? true : input.current)}
        >
          <DialogHeader>
            <DialogTitle>Allow TCP network</DialogTitle>
            <DialogDescription>
              This allows any TCP port in the range. Enrollment still requires permission.
            </DialogDescription>
          </DialogHeader>
          <form
            className='grid gap-4'
            onSubmit={event => {
              event.preventDefault()
              allowNetwork()
            }}
          >
            <FormField
              label='IPv4 CIDR range'
              description='Use /32 to allow a single address.'
              layout='vertical'
              error={fieldError || undefined}
            >
              <Input
                ref={input}
                name='network'
                autoComplete='off'
                autoCapitalize='off'
                spellCheck={false}
                placeholder='10.20.0.0/24…'
                value={entry}
                readOnly={pending}
                onChange={event => {
                  setEntry(event.target.value)
                  setFieldError('')
                }}
              />
            </FormField>
            {fromDeployment ? <p className='text-sm text-foreground-muted'>{deploymentListNote}</p> : null}
            {mutationError ? <Notice tone='danger'>{mutationError}</Notice> : null}
            <DialogFooter>
              <DialogClose asChild>
                <Button
                  type='button'
                  variant='secondary'
                  disabled={pending}
                >
                  Cancel
                </Button>
              </DialogClose>
              <MutationButton
                type='submit'
                pending={pending}
                pendingLabel='Allowing…'
              >
                Allow network
              </MutationButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmMutationDialog
        title='Remove TCP access?'
        description={
          <>
            Remove <code translate='no'>{removing}</code> from the allowlist? Devices that lose TCP access will
            disconnect.
          </>
        }
        confirmLabel='Remove access'
        pendingLabel='Removing…'
        pending={pending && removing !== null}
        open={removing !== null}
        error={mutationError}
        finalFocus={() => (removeTrigger.current?.isConnected ? removeTrigger.current : addTrigger.current)}
        onOpenChange={open => {
          if (!open) setRemoving(null)
        }}
        onConfirm={() => {
          if (policy && removing)
            void save(
              policy.endpoints.filter(endpoint => endpoint !== removing),
              'Allowlist entry removed.'
            )
        }}
      >
        {fromDeployment ? <p className='text-sm text-foreground-muted'>{deploymentListNote}</p> : null}
      </ConfirmMutationDialog>
    </>
  )
}
