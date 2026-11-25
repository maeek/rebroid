'use client'

import { useId, useRef, useState } from 'react'
import { isExternalAdbTcpEndpoint } from '@rebroid/android-application-core/android-device'
import { IconDeviceMobile, IconNetwork, IconRefresh } from '@tabler/icons-react'
import Link from 'next/link'
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
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { MutationButton } from '@/components/ui/mutation-button'
import { Notice, type NoticeTone } from '@/components/ui/notice'
import { RadioGroup, RadioOption } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getBff, sendBff } from '@/lib/http/bff'
import { externalDeviceBffPath } from '@/shared/contracts/external-device'
import { isApplicationId } from '@/shared/model/application-id'
import type { ExternalDevice, ExternalTcpCheck, ExternalUsbCandidate } from '@/shared/contracts/external-device'

const defaultTcpPort = '5555'

const connectionTypes = [
  { value: 'usb', label: 'USB', description: 'Phone plugged into the host', Icon: IconDeviceMobile },
  { value: 'tcp', label: 'ADB over TCP', description: 'Device on the network', Icon: IconNetwork }
] as const

const tcpCheckNotices = {
  reachable: {
    tone: 'success',
    title: 'TCP port reachable',
    description: 'The broker can reach this port. Verify ADB after registration.'
  },
  not_allowed: {
    tone: 'warning',
    title: 'Endpoint not approved',
    description: 'An administrator must allow this address in the External ADB TCP allowlist.'
  },
  network_blocked: {
    tone: 'warning',
    title: 'Broker network is protected',
    description: 'Use an address on a device network outside the broker’s own network.'
  },
  refused: {
    tone: 'warning',
    title: 'Connection refused',
    description: 'Check that ADB is listening on this port.'
  },
  timed_out: {
    tone: 'warning',
    title: 'Connection timed out',
    description: 'Check the device address, network route, and firewall rules.'
  },
  unreachable: {
    tone: 'warning',
    title: 'Endpoint unreachable',
    description: 'Check that the device is online and reachable from the Rebroid host.'
  }
} satisfies Record<ExternalTcpCheck['status'], { tone: NoticeTone; title: string; description: string }>

export function ExternalDeviceRegistrationDialog({
  open,
  onClose,
  onRegistered,
  canEnrollUsb,
  canManageBroker = false
}: {
  open: boolean
  onClose: () => void
  onRegistered: (device: ExternalDevice) => void
  canEnrollUsb: boolean
  canManageBroker?: boolean
}) {
  const formId = useId()
  const [selection, setTransport] = useState<'usb' | 'tcp'>('tcp')
  const transport = canEnrollUsb ? selection : 'tcp'
  const [address, setAddress] = useState('')
  const [port, setPort] = useState(defaultTcpPort)
  const endpoint = `${address.trim()}:${port.trim()}`
  const [addressError, setAddressError] = useState('')
  const addressInput = useRef<HTMLInputElement>(null)
  const [candidates, setCandidates] = useState<ExternalUsbCandidate[]>()
  const [candidateId, setCandidateId] = useState('')
  const [pending, setPending] = useState<'scan' | 'check' | 'register'>()
  const [scanError, setScanError] = useState('')
  const [tcpCheck, setTcpCheck] = useState<ExternalTcpCheck['status']>()
  const [tcpCheckError, setTcpCheckError] = useState('')
  const [error, setError] = useState('')

  const validateTcpEndpoint = () => {
    if (isExternalAdbTcpEndpoint(endpoint)) return true
    setAddressError('Enter an IPv4 address and a port from 1 to 65535.')
    addressInput.current?.focus()
    return false
  }

  const checkTcp = async () => {
    if (pending || !validateTcpEndpoint()) return
    setPending('check')
    setTcpCheck(undefined)
    setTcpCheckError('')
    try {
      const result = await sendBff<ExternalTcpCheck>(`${externalDeviceBffPath}/tcp-check`, { endpoint })
      setTcpCheck(result.status)
    } catch (cause) {
      setTcpCheckError(cause instanceof Error ? cause.message : 'Try checking the connection again.')
    } finally {
      setPending(undefined)
    }
  }

  const scan = async () => {
    if (pending) return
    setPending('scan')
    setScanError('')
    try {
      const rows = await getBff<ExternalUsbCandidate[]>(`${externalDeviceBffPath}/candidates`)
      setCandidates(rows)
      setCandidateId('')
    } catch (cause) {
      setScanError(cause instanceof Error ? cause.message : 'Could not check USB devices.')
    } finally {
      setPending(undefined)
    }
  }

  const register = async (form: HTMLFormElement) => {
    if (pending || (transport === 'usb' && !candidateId)) return
    if (transport === 'tcp' && !validateTcpEndpoint()) return
    setPending('register')
    setError('')
    const values = new FormData(form)
    try {
      const device = await sendBff<ExternalDevice>(externalDeviceBffPath, {
        name: values.get('name'),
        transport,
        ...(transport === 'usb' ? { candidateId } : { endpoint })
      })
      if (device.kind !== 'external' || !isApplicationId(device.id))
        throw new Error('Rebroid could not confirm the new device registration.')
      onRegistered(device)
      form.reset()
      setCandidateId('')
      setCandidates(undefined)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not register the device.')
    } finally {
      setPending(undefined)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen, event) => {
        if (nextOpen) return
        if (pending) {
          event.cancel()
          return
        }
        onClose()
      }}
      onOpenChangeComplete={nextOpen => {
        if (nextOpen) return
        setTransport('tcp')
        setAddress('')
        setPort(defaultTcpPort)
        setAddressError('')
        setCandidates(undefined)
        setCandidateId('')
        setScanError('')
        setTcpCheck(undefined)
        setTcpCheckError('')
        setError('')
      }}
    >
      <DialogContent
        data-editor-dialog=''
        className='sm:max-w-2xl'
      >
        <DialogHeader>
          <DialogTitle>Register device</DialogTitle>
          <DialogDescription>After registration, verify the device from its Connection page.</DialogDescription>
        </DialogHeader>
        <form
          className='grid min-w-0 gap-4'
          onSubmit={event => {
            event.preventDefault()
            void register(event.currentTarget)
          }}
        >
          {canEnrollUsb ? (
            <FormField
              label='Connection type'
              layout='vertical'
            >
              <RadioGroup
                aria-label='Connection type'
                value={transport}
                onValueChange={value => {
                  setTransport(value)
                  setError('')
                }}
                disabled={Boolean(pending)}
                className='grid w-full gap-2 sm:grid-cols-2'
              >
                {connectionTypes.map(({ value, label, description, Icon }) => (
                  <RadioOption
                    key={value}
                    value={value}
                    aria-label={label}
                    aria-describedby={`${formId}-${value}-description`}
                    className='min-h-16 border border-control-border-strong/45 px-3 py-2.5 data-[checked]:border-primary/50 touch:min-h-16'
                  >
                    <span className='grid min-w-0 flex-1 gap-0.5 text-left'>
                      <span className='font-medium'>{label}</span>
                      <span
                        id={`${formId}-${value}-description`}
                        className='text-xs leading-4 text-foreground-muted'
                      >
                        {description}
                      </span>
                    </span>
                    <Icon
                      aria-hidden
                      className='size-5 shrink-0 text-foreground-muted group-data-[checked]:text-primary'
                    />
                  </RadioOption>
                ))}
              </RadioGroup>
            </FormField>
          ) : null}
          {transport === 'tcp' ? (
            <div className='grid gap-3'>
              <div className='grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]'>
                <FormField
                  label='IP address'
                  layout='vertical'
                  required
                  error={addressError || undefined}
                >
                  <Input
                    ref={addressInput}
                    name='address'
                    required
                    autoComplete='off'
                    spellCheck={false}
                    placeholder='192.168.1.20…'
                    value={address}
                    readOnly={pending === 'check'}
                    onChange={event => {
                      setAddress(event.target.value)
                      setAddressError('')
                      setTcpCheck(undefined)
                      setTcpCheckError('')
                    }}
                  />
                </FormField>
                <FormField
                  label='TCP port'
                  layout='vertical'
                  required
                >
                  <Input
                    name='port'
                    type='number'
                    required
                    min={1}
                    max={65535}
                    autoComplete='off'
                    value={port}
                    readOnly={pending === 'check'}
                    onChange={event => {
                      setPort(event.target.value)
                      setAddressError('')
                      setTcpCheck(undefined)
                      setTcpCheckError('')
                    }}
                  />
                </FormField>
              </div>
              <MutationButton
                type='button'
                variant='secondary'
                className='w-fit'
                pending={pending === 'check'}
                disabled={Boolean(pending) || !address.trim() || !port.trim()}
                pendingLabel='Checking…'
                onClick={() => void checkTcp()}
              >
                Check connection
              </MutationButton>
              {tcpCheck ? (
                <Notice
                  {...tcpCheckNotices[tcpCheck]}
                  actions={
                    tcpCheck === 'not_allowed' && canManageBroker ? (
                      <Button
                        asChild
                        variant='secondary'
                      >
                        <Link href='/platform/external-adb#allowed-endpoints'>TCP allowlist</Link>
                      </Button>
                    ) : undefined
                  }
                />
              ) : null}
              {tcpCheckError ? (
                <Notice
                  tone='danger'
                  title='Connection check unavailable'
                  description={tcpCheckError}
                />
              ) : null}
            </div>
          ) : (
            <div className='grid gap-3'>
              <div className='grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end'>
                {candidates?.length ? (
                  <FormField
                    label='USB device'
                    layout='vertical'
                  >
                    <Select
                      value={candidateId}
                      onValueChange={setCandidateId}
                      disabled={Boolean(pending)}
                    >
                      <SelectTrigger className='w-full'>
                        <SelectValue placeholder='Select a USB device' />
                      </SelectTrigger>
                      <SelectContent>
                        {candidates.map(candidate => (
                          <SelectItem
                            key={candidate.candidateId}
                            value={candidate.candidateId}
                          >
                            {candidate.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>
                ) : (
                  <div className='grid gap-1'>
                    <p
                      role='status'
                      className='text-sm font-medium'
                    >
                      {candidates ? 'No USB devices found on approved ports.' : 'Find your phone'}
                    </p>
                    <p className='text-sm text-foreground-muted'>
                      Plug your phone into an approved USB port on the Rebroid host and enable USB debugging.
                    </p>
                  </div>
                )}
                <MutationButton
                  type='button'
                  variant='secondary'
                  className='w-fit'
                  pending={pending === 'scan'}
                  disabled={Boolean(pending)}
                  pendingLabel='Checking…'
                  onClick={() => void scan()}
                >
                  <IconRefresh
                    aria-hidden
                    className='size-4'
                  />
                  {candidates ? 'Scan again' : 'Find USB devices'}
                </MutationButton>
              </div>
              {scanError ? <Notice tone='danger'>{scanError}</Notice> : null}
            </div>
          )}
          <FormField
            label='Name'
            layout='vertical'
          >
            <Input
              name='name'
              autoComplete='off'
              placeholder={transport === 'usb' ? 'Lab phone…' : 'Android test VM…'}
              required
              minLength={2}
              maxLength={100}
            />
          </FormField>
          {error ? <Notice tone='danger'>{error}</Notice> : null}
          <DialogFooter>
            <DialogClose asChild>
              <Button
                type='button'
                variant='secondary'
                disabled={Boolean(pending)}
              >
                Cancel
              </Button>
            </DialogClose>
            <MutationButton
              type='submit'
              pending={pending === 'register'}
              disabled={Boolean(pending) || (transport === 'usb' && !candidateId)}
              pendingLabel='Registering…'
            >
              Register device
            </MutationButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
