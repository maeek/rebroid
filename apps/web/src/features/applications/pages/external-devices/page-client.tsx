'use client'

import { useState } from 'react'
import { IconPlus } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Notice } from '@/components/ui/notice'
import { Section } from '@/components/ui/section'
import { Skeleton } from '@/components/ui/skeleton'
import { externalDeviceHref } from '@/shared/model/applications/external-device-links'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'
import { StateView } from '@/shared/ui/state-view'
import { ExternalDeviceRegistrationDialog } from '../register-device/registration-dialog'
import { AvailabilityNotice } from './availability-notice'
import { ExternalDeviceConnection } from './device-connection'
import type { ExternalDevice, ExternalDeviceAvailability } from '@/shared/contracts/external-device'

export function ExternalDevicesPage({
  initialDevices,
  availability,
  administrator,
  canEnroll,
  canConnect,
  userId,
  openRegistration = false,
  loading = false
}: {
  initialDevices: ExternalDevice[]
  availability?: ExternalDeviceAvailability
  administrator: boolean
  canEnroll: boolean
  canConnect: boolean
  userId: string
  openRegistration?: boolean
  loading?: boolean
}) {
  const router = useRouter()
  const [devices, setDevices] = useState(initialDevices)
  const [registrationOpen, setRegistrationOpen] = useState(openRegistration)
  const enabled = availability?.enabled === true
  const status = availability?.status
  const canRegister = !loading && canEnroll && enabled
  const showRegistration = () => setRegistrationOpen(true)
  const closeRegistration = () => {
    setRegistrationOpen(false)
    if (openRegistration) router.replace('/devices')
  }
  const openRegisteredDevice = (device: ExternalDevice) => {
    setDevices(current => [device, ...current.filter(row => row.id !== device.id)])
    setRegistrationOpen(false)
    const href = externalDeviceHref(device.id, 'connection')
    if (openRegistration) router.replace(href)
    else router.push(href)
  }
  const description = administrator
    ? 'Connect Android devices over USB or ADB over TCP.'
    : 'Connect Android devices using an approved ADB address and port.'
  return (
    <StandardPage>
      <PageHeader
        title='Devices'
        section={{ label: 'Devices' }}
        breadcrumbLabel='All devices'
        description={loading ? 'Connect an Android device over ADB.' : description}
        actions={
          canRegister ? (
            <Button onClick={showRegistration}>
              <IconPlus
                aria-hidden
                className='size-4'
              />{' '}
              Register device
            </Button>
          ) : undefined
        }
      />
      <PageContent>
        {loading ? (
          <Notice
            loading
            title={<Skeleton className='h-4 w-48' />}
            description={<Skeleton className='h-4 w-full max-w-md' />}
          />
        ) : null}
        {!loading && status && status !== 'available' ? (
          <AvailabilityNotice
            status={status}
            administrator={administrator}
          />
        ) : null}
        {enabled && devices.length === 0 ? (
          <StateView
            kind='empty'
            headingLevel={2}
            scope='grid'
            artwork='external-devices'
            artworkSize='page'
            title='No external devices yet'
            description={
              canEnroll
                ? 'Register a device, then verify its ADB connection to open the viewer.'
                : 'Ask an administrator for the Enroll external devices privilege to add your own devices.'
            }
            actions={
              canRegister ? [{ label: 'Register device', onClick: showRegistration, variant: 'primary' }] : undefined
            }
          />
        ) : null}
        {devices.length > 0 ? (
          <Section
            surface='plain'
            title='Registered devices'
          >
            <div className='grid items-start gap-4 lg:grid-cols-2 2xl:grid-cols-3'>
              {devices.map(device => (
                <ExternalDeviceConnection
                  key={device.id}
                  device={device}
                  linkToDetails
                  enabled={enabled}
                  canEnroll={canEnroll}
                  canConnect={canConnect}
                  ownedByCurrentUser={device.ownerUserId === userId}
                  onChange={changed =>
                    setDevices(current => current.map(row => (row.id === changed.id ? changed : row)))
                  }
                  onForget={() => setDevices(current => current.filter(row => row.id !== device.id))}
                />
              ))}
            </div>
          </Section>
        ) : null}
      </PageContent>
      {canRegister ? (
        <ExternalDeviceRegistrationDialog
          open={registrationOpen}
          canEnrollUsb={administrator}
          onClose={closeRegistration}
          onRegistered={openRegisteredDevice}
        />
      ) : null}
    </StandardPage>
  )
}

export const ExternalDevicesLoading = () => (
  <ExternalDevicesPage
    initialDevices={[]}
    administrator={false}
    canEnroll={false}
    canConnect={false}
    userId=''
    loading
  />
)
