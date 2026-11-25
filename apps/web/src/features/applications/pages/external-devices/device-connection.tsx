'use client'

import { useState } from 'react'
import { externalDeviceChallengePath } from '@rebroid/android-application-core/android-device'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ConfirmMutationDialog } from '@/components/ui/confirm-mutation-dialog'
import { MutationButton } from '@/components/ui/mutation-button'
import { Notice } from '@/components/ui/notice'
import { Section } from '@/components/ui/section'
import { sendBff } from '@/lib/http/bff'
import { externalDeviceBffPath } from '@/shared/contracts/external-device'
import {
  externalDeviceHref,
  externalDeviceStatusLabel,
  externalDeviceViewerHref
} from '@/shared/model/applications/external-device-links'
import { DateTimeValue } from '@/shared/ui/date-time-value'
import type { ExternalDevice, ExternalVerificationInstructions } from '@/shared/contracts/external-device'
import type { ExternalDeviceVerificationProof } from '@rebroid/android-application-core/android-device'

const failureMessage = {
  transport_unavailable: 'Check that the device is still attached, then connect again.',
  verification_required: 'Connect again and verify the new connection.',
  attempt_expired: 'The connection expired. Connect again to continue.',
  broker_unavailable: 'The ADB broker is unavailable. Try again when the service is back.'
}

const connectionHelp = {
  connecting: 'Rebroid is looking for this device through the ADB broker.',
  awaiting_android_approval: 'Approve the debugging prompt on Android, then check ADB status.',
  awaiting_usb_replug:
    'Unplug this phone, select Check connection, then plug it back into the same USB port and check again.',
  awaiting_verification: 'Someone with enrollment permission must verify the identity of this device.'
} as const

export function ExternalDeviceConnection({
  device,
  enabled,
  canEnroll,
  canConnect,
  ownedByCurrentUser,
  linkToDetails = false,
  onChange,
  onForget
}: {
  device: ExternalDevice
  enabled: boolean
  canEnroll: boolean
  canConnect: boolean
  ownedByCurrentUser: boolean
  linkToDetails?: boolean
  onChange: (device: ExternalDevice) => void
  onForget: () => void
}) {
  const [pending, setPending] = useState('')
  const [error, setError] = useState('')
  const [forgetting, setForgetting] = useState(false)
  const [verification, setVerification] = useState<ExternalVerificationInstructions>()
  const { state, attemptId, attachmentId, failure, observedAt } = device.connection
  const help = Object.hasOwn(connectionHelp, state) ? connectionHelp[state as keyof typeof connectionHelp] : null
  const path = `${externalDeviceBffPath}/${encodeURIComponent(device.id)}`
  const run = async (action: string, proof?: ExternalDeviceVerificationProof) => {
    if (pending) return
    setPending(action)
    setError('')
    try {
      if (action === 'instructions') {
        setVerification(await sendBff<ExternalVerificationInstructions>(path, { action, attemptId }))
        return
      }
      if (action === 'forget') {
        await sendBff(path, { action })
        onForget()
        return
      }
      const body = action === 'verify' ? { action, attemptId, proof } : { action }
      const changed = await sendBff<ExternalDevice>(path, body)
      if (action !== 'refresh' || changed.connection.attemptId !== attemptId) setVerification(undefined)
      onChange(changed)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The device operation failed.')
    } finally {
      setPending('')
    }
  }
  const button = (action: string, label: string, proof?: ExternalDeviceVerificationProof) => (
    <MutationButton
      variant='outline'
      pending={pending === action}
      pendingLabel='Working…'
      disabled={Boolean(pending)}
      onClick={() => void run(action, proof)}
    >
      {label}
    </MutationButton>
  )
  return (
    <Section
      surface='panel'
      title={
        linkToDetails ? (
          <Link
            href={externalDeviceHref(device.id)}
            className='break-words hover:underline'
          >
            {device.name}
          </Link>
        ) : (
          'ADB connection'
        )
      }
      headingLevel={3}
      description={
        <span aria-live='polite'>
          {device.transport === 'usb' ? 'USB' : 'TCP'} · {externalDeviceStatusLabel[state]}
        </span>
      }
    >
      {error && !forgetting ? <Notice tone='danger'>{error}</Notice> : null}
      {enabled && help ? <p className='text-sm text-foreground-muted'>{help}</p> : null}
      {state === 'offline' && failure ? <p className='text-sm'>{failureMessage[failure]}</p> : null}
      {observedAt ? (
        <p className='text-xs text-foreground-muted'>
          Last checked{' '}
          <DateTimeValue
            value={observedAt}
            compact
          />
        </p>
      ) : null}
      {canEnroll && enabled && attemptId && state !== 'ready' ? (
        <div className='flex flex-col gap-2'>
          {verification?.fingerprint ? (
            <p className='break-all text-sm'>
              ADB host fingerprint <code>{verification.fingerprint}</code>
            </p>
          ) : null}
          {verification?.challenge && state === 'awaiting_verification' ? (
            <p className='break-words text-sm'>
              From the VM console, write <code>{verification.challenge}</code> to{' '}
              <code>{externalDeviceChallengePath}</code>.
            </p>
          ) : null}
          {device.transport === 'usb' && state === 'awaiting_verification' ? (
            <p className='text-sm'>Confirm the phone you just connected or approved on Android.</p>
          ) : null}
        </div>
      ) : null}
      <div className='flex flex-wrap gap-2'>
        {enabled && canConnect && ownedByCurrentUser && state === 'ready' && attachmentId ? (
          <Button asChild>
            <Link
              prefetch={false}
              href={externalDeviceViewerHref(device.id, attachmentId)}
            >
              Open viewer
            </Link>
          </Button>
        ) : null}
        {enabled && canConnect && ownedByCurrentUser && (state === 'disconnected' || state === 'offline')
          ? button('connect', 'Connect')
          : null}
        {enabled && attemptId && (canEnroll || canConnect) ? button('refresh', 'Check connection') : null}
        {canEnroll &&
        enabled &&
        attemptId &&
        state !== 'ready' &&
        (device.transport === 'tcp' || state === 'awaiting_android_approval')
          ? button('instructions', 'Verification details')
          : null}
        {canEnroll && enabled && state === 'awaiting_verification' && device.transport === 'usb'
          ? button('verify', 'Verify USB device', 'physical')
          : null}
        {canEnroll && enabled && state === 'awaiting_verification' && verification?.challenge
          ? button('verify', 'Verify VM challenge', 'challenge')
          : null}
        {canEnroll &&
        enabled &&
        state === 'awaiting_verification' &&
        device.transport === 'tcp' &&
        verification?.androidPromptObserved &&
        verification.fingerprint
          ? button('verify', 'Confirm matching Android prompt', 'android_prompt')
          : null}
        {state !== 'disconnected'
          ? button(
              'disconnect',
              attemptId && state !== 'ready' && state !== 'offline' ? 'Cancel connection' : 'Disconnect'
            )
          : null}
        <Button
          variant='danger-ghost'
          disabled={Boolean(pending)}
          onClick={() => {
            setError('')
            setForgetting(true)
          }}
        >
          Forget device…
        </Button>
      </div>
      <ConfirmMutationDialog
        title='Forget device'
        description={`Remove ${device.name} from Rebroid and end its connection.`}
        confirmLabel='Forget device'
        open={forgetting}
        onOpenChange={setForgetting}
        pending={pending === 'forget'}
        pendingLabel='Forgetting…'
        error={error}
        onConfirm={() => void run('forget')}
      />
    </Section>
  )
}
