import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { sendBff } from '@/lib/http/bff'
import { externalDeviceBffPath, type ExternalDevice } from '@/shared/contracts/external-device'
import { ExternalDevicesPage } from './page-client'

vi.mock('@/lib/http/bff', () => ({ sendBff: vi.fn(), getBff: vi.fn() }))
const { replace } = vi.hoisted(() => ({ replace: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), replace }) }))

const attemptId = '66b62508-65d0-4cdc-a5c0-4a4352909430'
const disconnected: ExternalDevice['connection'] = {
  state: 'disconnected',
  attemptId: null,
  attachmentId: null,
  observedAt: null,
  failure: null
}
const vm: ExternalDevice = {
  id: '303ea61a-93cd-4af0-810d-142b1fae3335',
  kind: 'external',
  name: 'Android VM',
  ownerUserId: 'owner',
  transport: 'tcp',
  connection: disconnected,
  createdAt: '2026-11-24T12:00:00.000Z'
}
const path = `${externalDeviceBffPath}/${vm.id}`

describe('external devices console', () => {
  it('opens registration from the header and empty state on the inventory page', async () => {
    render(
      <ExternalDevicesPage
        initialDevices={[]}
        availability={{ enabled: true, status: 'available', usb: 'not_configured' }}
        administrator
        canEnroll
        canConnect
        userId='owner'
      />
    )
    const headerAction = within(screen.getByRole('banner')).getByRole('button', { name: 'Register device' })
    const emptyStateAction = within(screen.getByRole('status')).getByRole('button', { name: 'Register device' })

    fireEvent.click(headerAction)
    const dialog = await screen.findByRole('dialog', { name: 'Register device' })
    expect(within(dialog).queryByRole('radio', { name: 'USB' })).not.toBeInTheDocument()
    expect(within(dialog).getByRole('textbox', { name: /IP address/ })).toBeVisible()
    fireEvent.change(within(dialog).getByRole('spinbutton', { name: /TCP port/ }), { target: { value: '5556' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Register device' })).toBeNull())
    fireEvent.click(emptyStateAction)
    const reopened = within(await screen.findByRole('dialog', { name: 'Register device' }))
    expect(reopened.getByRole('spinbutton', { name: /TCP port/ })).toHaveValue(5555)
  })

  it('takes a successful registration from the sidebar route to Connection', async () => {
    vi.mocked(sendBff).mockResolvedValueOnce(vm)
    render(
      <ExternalDevicesPage
        initialDevices={[]}
        availability={{ enabled: true, status: 'available' }}
        administrator={false}
        canEnroll
        canConnect
        userId='owner'
        openRegistration
      />
    )
    const dialog = within(await screen.findByRole('dialog', { name: 'Register device' }))
    fireEvent.change(dialog.getByRole('textbox', { name: /IP address/ }), { target: { value: '192.168.1.20' } })
    fireEvent.change(dialog.getByRole('spinbutton', { name: /TCP port/ }), { target: { value: '5555' } })
    fireEvent.change(dialog.getByRole('textbox', { name: 'Name' }), { target: { value: vm.name } })
    fireEvent.click(dialog.getByRole('button', { name: 'Register device' }))
    await waitFor(() => expect(replace).toHaveBeenCalledWith(`/devices/external/${vm.id}?view=connection`))
    expect(await screen.findByRole('link', { name: vm.name })).toBeVisible()
  })
  it.each([
    ['not_configured', 'ADB broker is not configured'],
    ['feature_disabled', 'External devices are turned off'],
    ['broker_unavailable', 'ADB broker is unavailable']
  ] as const)('shows the %s reason before the inventory', (status, message) => {
    render(
      <ExternalDevicesPage
        initialDevices={[vm]}
        availability={{ enabled: false, status }}
        administrator
        canEnroll
        canConnect
        userId='owner'
      />
    )
    expect(screen.getByText(message)).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Register device' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Connect' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Forget device…' })).toBeVisible()
  })

  it('verifies a TCP connection and forgets its registration after disconnecting', async () => {
    const waiting = { ...disconnected, state: 'awaiting_verification', attemptId }
    vi.mocked(sendBff)
      .mockResolvedValueOnce({ ...vm, connection: waiting })
      .mockResolvedValueOnce({ challenge: 'one-time-challenge', fingerprint: null, androidPromptObserved: false })
      .mockResolvedValueOnce({ ...vm, connection: { ...waiting, state: 'ready', attachmentId: 'new-attachment' } })
      .mockResolvedValueOnce(vm)
      .mockResolvedValueOnce({ id: vm.id })

    render(
      <ExternalDevicesPage
        initialDevices={[vm]}
        availability={{ enabled: true, status: 'available' }}
        administrator
        canEnroll
        canConnect
        userId='owner'
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Verification details' }))
    expect(await screen.findByText('one-time-challenge')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Verify VM challenge' }))
    expect(await screen.findByText(/Verified and connected/)).toBeVisible()
    expect(sendBff).toHaveBeenCalledWith(path, { action: 'verify', attemptId, proof: 'challenge' })

    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }))
    expect(await screen.findByRole('button', { name: 'Connect' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Forget device…' }))
    const confirmation = await screen.findByRole('dialog', { name: 'Forget device' })
    expect(within(confirmation).getByText(/Remove Android VM from Rebroid/)).toBeVisible()
    fireEvent.click(within(confirmation).getByRole('button', { name: 'Forget device' }))
    expect(await screen.findByText('No external devices yet')).toBeVisible()
    expect(sendBff).toHaveBeenLastCalledWith(path, { action: 'forget' })
  })
})
