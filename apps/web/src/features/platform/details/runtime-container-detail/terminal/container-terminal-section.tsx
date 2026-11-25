'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { FormLoadingBoundary } from '@/components/ui/form-loading-boundary'
import { Input } from '@/components/ui/input'
import { MutationButton } from '@/components/ui/mutation-button'
import { Notice } from '@/components/ui/notice'
import { Skeleton } from '@/components/ui/skeleton'
import { PlatformResourceSection } from '@/shared/ui/platform/platform-resource-section'
import { useContainerTerminal } from './use-container-terminal'
import type { PlatformContainerSummary } from '@/shared/contracts/platform'
import '@xterm/xterm/css/xterm.css'

const userPattern = /^[a-zA-Z0-9_][a-zA-Z0-9_.-]*(?::[a-zA-Z0-9_][a-zA-Z0-9_.-]*)?$/

export const ContainerTerminalSection = ({ container, startedAt }: PlatformContainerSummary) => {
  let unavailable: string | undefined
  if (!container.managed || container.component !== 'runtime' || container.orphaned) {
    unavailable = 'Terminal access is available for managed Android runtimes.'
  } else if (container.state !== 'running' || !startedAt) {
    unavailable = 'Container must be running to open a terminal.'
  }
  return (
    <ContainerTerminalContent
      key={`${container.id}:${startedAt ?? ''}`}
      containerId={container.id}
      startedAt={startedAt ?? undefined}
      unavailable={unavailable}
    />
  )
}

export const ContainerTerminalContent = ({
  containerId,
  startedAt,
  unavailable,
  loading = false
}: {
  containerId?: string
  startedAt?: string
  unavailable?: string
  loading?: boolean
}) => {
  const [user, setUser] = useState('')
  const [invalid, setInvalid] = useState(false)
  const { host, status, message, connect, disconnect } = useContainerTerminal(containerId, startedAt)
  const pending = status === 'connecting'
  const connected = status === 'connected'
  const controls = (
    <form
      className='flex flex-wrap items-end gap-3'
      onSubmit={event => {
        event.preventDefault()
        if (loading || unavailable || pending || connected) return
        const selectedUser = user.trim()
        if (selectedUser && !userPattern.test(selectedUser)) {
          setInvalid(true)
          return
        }
        void connect(selectedUser)
      }}
    >
      <FormField
        label='Container user'
        layout='vertical'
        className='sm:w-72'
        error={invalid ? 'Enter a user name or UID, optionally followed by a group.' : undefined}
      >
        <Input
          value={user}
          onChange={event => {
            setUser(event.target.value)
            setInvalid(false)
          }}
          placeholder='Container default'
          maxLength={128}
          autoComplete='off'
          spellCheck={false}
          disabled={loading || Boolean(unavailable) || pending || connected}
        />
      </FormField>
      {connected ? (
        <Button
          type='button'
          variant='outline'
          onClick={disconnect}
        >
          Disconnect
        </Button>
      ) : (
        <MutationButton
          type='submit'
          pending={pending}
          pendingLabel='Connecting…'
          disabled={loading || Boolean(unavailable)}
        >
          Connect
        </MutationButton>
      )}
      {pending ? (
        <Button
          type='button'
          variant='ghost'
          onClick={disconnect}
        >
          Cancel
        </Button>
      ) : null}
    </form>
  )
  return (
    <PlatformResourceSection
      title='Terminal'
      surface='plain'
      description='Open a shell as a container user. Leave blank to use the container default.'
      className='lg:flex-1'
      contentClassName='gap-4 lg:min-h-0 lg:flex-1'
    >
      {loading ? <FormLoadingBoundary>{controls}</FormLoadingBoundary> : controls}
      {unavailable || message ? (
        <Notice
          tone={status === 'error' ? 'danger' : 'info'}
          description={unavailable ?? message}
        />
      ) : null}
      <div className='relative min-h-64 overflow-hidden rounded-panel bg-surface-band text-foreground max-lg:h-[40dvh] lg:flex-1 lg:[contain:size]'>
        {loading ? (
          <Skeleton className='absolute inset-0' />
        ) : (
          <div
            ref={host}
            className='absolute inset-0 bg-surface-band px-3 py-2'
            aria-label='Container terminal'
          />
        )}
      </div>
    </PlatformResourceSection>
  )
}
