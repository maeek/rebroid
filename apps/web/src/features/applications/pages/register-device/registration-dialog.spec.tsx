import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getBff, sendBff } from '@/lib/http/bff'
import { externalDeviceBffPath } from '@/shared/contracts/external-device'
import { ExternalDeviceRegistrationDialog } from './registration-dialog'

vi.mock('@/lib/http/bff', () => ({ getBff: vi.fn(), sendBff: vi.fn() }))

describe('external device registration', () => {
  beforeEach(() => vi.resetAllMocks())

  it('starts with USB discovery and shows an actionable empty result', async () => {
    vi.mocked(getBff).mockResolvedValue([])
    render(
      <ExternalDeviceRegistrationDialog
        open
        onClose={vi.fn()}
        canEnrollUsb
        onRegistered={vi.fn()}
      />
    )

    expect(screen.getByRole('radio', { name: 'USB' })).toBeChecked()
    expect(screen.queryByRole('combobox', { name: 'USB device' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Register device' })).toBeDisabled()
    expect(getBff).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Find USB devices' }))

    expect(await screen.findByText('No USB devices found on approved ports.')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Scan again' })).toBeEnabled()
    expect(getBff).toHaveBeenCalledWith(`${externalDeviceBffPath}/candidates`)
  })

  it('submits the TCP draft from the dialog and keeps it when registration fails', async () => {
    const onRegistered = vi.fn()
    vi.mocked(sendBff).mockRejectedValue(new Error('This device is already registered.'))
    render(
      <ExternalDeviceRegistrationDialog
        open
        onClose={vi.fn()}
        canEnrollUsb
        onRegistered={onRegistered}
      />
    )

    fireEvent.click(screen.getByRole('radio', { name: 'ADB over TCP' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: 'Test VM' } })
    fireEvent.change(screen.getByRole('textbox', { name: /IP address/ }), { target: { value: '192.168.1.20' } })
    fireEvent.change(screen.getByRole('spinbutton', { name: /TCP port/ }), { target: { value: '5555' } })
    expect(screen.queryByRole('button', { name: 'Find USB devices' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Register device' }))

    await waitFor(() =>
      expect(sendBff).toHaveBeenCalledWith(externalDeviceBffPath, {
        name: 'Test VM',
        transport: 'tcp',
        endpoint: '192.168.1.20:5555'
      })
    )
    expect(await screen.findByText('This device is already registered.')).toBeVisible()
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Test VM')
    expect(onRegistered).not.toHaveBeenCalled()
  })

  it('shows TCP enrollment directly for a non-administrator', () => {
    render(
      <ExternalDeviceRegistrationDialog
        open
        onClose={vi.fn()}
        canEnrollUsb={false}
        onRegistered={vi.fn()}
      />
    )
    expect(screen.getByRole('textbox', { name: /IP address/ })).toBeVisible()
    expect(screen.queryByRole('radio', { name: 'USB' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Find USB devices' })).not.toBeInTheDocument()
  })

  it('checks a TCP endpoint before registration and clears the result when the endpoint changes', async () => {
    const onRegistered = vi.fn()
    vi.mocked(sendBff).mockResolvedValueOnce({ status: 'reachable' }).mockResolvedValueOnce({ status: 'refused' })
    render(
      <ExternalDeviceRegistrationDialog
        open
        onClose={vi.fn()}
        canEnrollUsb={false}
        onRegistered={onRegistered}
      />
    )

    const check = screen.getByRole('button', { name: 'Check connection' })
    const port = screen.getByRole('spinbutton', { name: /TCP port/ })
    expect(check).toBeDisabled()
    fireEvent.change(screen.getByRole('textbox', { name: /IP address/ }), { target: { value: '192.168.1.20' } })
    fireEvent.change(port, { target: { value: '5555' } })
    fireEvent.click(check)

    expect(await screen.findByText('TCP port reachable')).toBeVisible()
    expect(sendBff).toHaveBeenNthCalledWith(1, `${externalDeviceBffPath}/tcp-check`, { endpoint: '192.168.1.20:5555' })
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('')

    fireEvent.change(port, { target: { value: '5556' } })
    expect(screen.queryByText('TCP port reachable')).not.toBeInTheDocument()
    fireEvent.click(check)

    expect(await screen.findByText('Connection refused')).toBeVisible()
    expect(sendBff).toHaveBeenNthCalledWith(2, `${externalDeviceBffPath}/tcp-check`, { endpoint: '192.168.1.20:5556' })
    expect(onRegistered).not.toHaveBeenCalled()
  })
})
