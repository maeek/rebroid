import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { updateExternalTcpPolicyAction } from '@/server/orchestrator/external-devices/broker-actions'
import { AllowedEndpointsSection } from './allowed-endpoints-section'

vi.mock('@/server/orchestrator/external-devices/broker-actions', () => ({ updateExternalTcpPolicyAction: vi.fn() }))

const endpoint = '192.168.1.20:5555'
const network = '192.168.1.0/24'
const updatePolicy = vi.mocked(updateExternalTcpPolicyAction)

beforeEach(() => {
  updatePolicy.mockReset()
})

it('validates the CIDR and lists it only after it is saved', async () => {
  updatePolicy.mockResolvedValue({
    ok: true,
    requestId: 'policy-save',
    data: { revision: 1, endpoints: [network] }
  })
  render(<AllowedEndpointsSection initialPolicy={{ revision: 0, endpoints: [] }} />)
  expect(screen.getByText('No addresses are allowed yet.')).toBeVisible()

  fireEvent.click(screen.getByRole('button', { name: 'Allow network' }))
  const dialog = within(screen.getByRole('dialog', { name: 'Allow TCP network' }))
  expect(dialog.getByText(/replaces the deployment defaults/)).toBeVisible()
  const input = dialog.getByRole('textbox', { name: 'IPv4 CIDR range' })
  fireEvent.change(input, { target: { value: '192.168.1.20/24' } })
  fireEvent.click(dialog.getByRole('button', { name: 'Allow network' }))
  expect(dialog.getByText(/Enter an IPv4 CIDR/)).toBeVisible()
  expect(updatePolicy).not.toHaveBeenCalled()

  fireEvent.change(input, { target: { value: network } })
  fireEvent.click(dialog.getByRole('button', { name: 'Allow network' }))
  expect(await screen.findByText('Network allowed.')).toBeVisible()
  expect(updatePolicy).toHaveBeenCalledWith({ revision: 0, endpoints: [network] })
  expect(await screen.findByRole('button', { name: `Remove ${network}` })).toBeVisible()
})

it('preserves the address in the dialog when saving fails', async () => {
  updatePolicy.mockResolvedValue({
    ok: false,
    requestId: 'policy-conflict',
    error: {
      code: 'conflict',
      message: 'The allowed endpoints changed. Reload before saving.',
      requestId: 'policy-conflict'
    }
  })
  render(<AllowedEndpointsSection initialPolicy={{ revision: 2, endpoints: [] }} />)
  fireEvent.click(screen.getByRole('button', { name: 'Allow network' }))
  const dialog = within(screen.getByRole('dialog', { name: 'Allow TCP network' }))
  const input = dialog.getByRole('textbox', { name: 'IPv4 CIDR range' })
  fireEvent.change(input, { target: { value: network } })
  fireEvent.click(dialog.getByRole('button', { name: 'Allow network' }))
  expect(await dialog.findByText(/Reference policy-conflict/)).toBeVisible()
  expect(input).toHaveValue(network)
  expect(screen.queryByText('Network allowed.')).not.toBeInTheDocument()
})

it('only removes an endpoint after confirmation and can save an empty allowlist', async () => {
  updatePolicy.mockResolvedValue({
    ok: true,
    requestId: 'policy-save',
    data: { revision: 2, endpoints: [] }
  })
  render(<AllowedEndpointsSection initialPolicy={{ revision: 1, endpoints: [endpoint] }} />)
  const remove = screen.getByRole('button', { name: `Remove ${endpoint}` })
  fireEvent.click(remove)
  const dialog = within(screen.getByRole('dialog', { name: 'Remove TCP access?' }))
  expect(dialog.getByText(/Devices that lose TCP access will disconnect/)).toBeVisible()
  expect(updatePolicy).not.toHaveBeenCalled()
  fireEvent.click(dialog.getByRole('button', { name: 'Cancel' }))
  expect(await screen.findByRole('button', { name: `Remove ${endpoint}` })).toBeVisible()
  expect(updatePolicy).not.toHaveBeenCalled()

  fireEvent.click(remove)
  fireEvent.click(screen.getByRole('button', { name: 'Remove access' }))
  expect(await screen.findByText('Allowlist entry removed.')).toBeVisible()
  expect(updatePolicy).toHaveBeenCalledWith({ revision: 1, endpoints: [] })
  expect(screen.getByText('No addresses are allowed yet.')).toBeVisible()
})
