import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from '@/hooks/use-toast'
import { submitCreateApplicationAction } from '@/server/orchestrator/applications/actions/configuration/create-update-actions'
import { actionError, actionOk } from '@/shared/actions/action-result'
import { defaultOrchestratorUiSettings } from '@/shared/model/settings/orchestrator-ui-settings'
import { CreateAppForm } from './create-app-form'

const { push } = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }))
vi.mock('nextjs-toploader', () => ({
  useTopLoader: () => ({ start: vi.fn(), setProgress: vi.fn(), done: vi.fn() })
}))
vi.mock('@/server/orchestrator/applications/actions/configuration/create-update-actions', () => ({
  submitCreateApplicationAction: vi.fn()
}))
vi.mock('@/server/app-icons/actions/set-app-icon-action', () => ({ setAppIconAction: vi.fn() }))
vi.mock('@/features/applications/apks/upload-apk-with-feedback', () => ({ uploadApkWithFeedback: vi.fn() }))
vi.mock('@/shared/model/settings/use-orchestrator-ui-settings', () => ({
  useOrchestratorUiSettings: (settings: unknown) => settings
}))
vi.mock('@/shared/model/settings/use-resource-limit-bounds', () => ({
  useResourceLimitBounds: () => ({ maxMemoryMb: 16384, maxCpuCpus: 8 })
}))

const renderForm = () =>
  render(
    <CreateAppForm
      images={[]}
      initialSettings={defaultOrchestratorUiSettings}
      permissions={{ 'applications:change-resources': true }}
      canBuildImages={false}
    />
  )

describe('Create app failure feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(submitCreateApplicationAction).mockReset()
  })

  it('shows and links to a field error before sending an invalid draft', () => {
    renderForm()
    fireEvent.click(screen.getByRole('button', { name: 'Create app' }))

    const name = screen.getByRole('textbox', { name: /Name/ })
    expect(name).toHaveAccessibleDescription(/Enter a name with at least 2 characters/)
    fireEvent.click(screen.getByRole('button', { name: 'Go to first error' }))
    expect(name).toHaveFocus()
    expect(submitCreateApplicationAction).not.toHaveBeenCalled()
  })

  it('keeps the outage visible with a request reference and preserves the draft for retry', async () => {
    vi.mocked(submitCreateApplicationAction).mockResolvedValueOnce(
      actionError({ message: 'The container engine is unavailable.', code: 'upstream_unavailable' }, 'create-123')
    )
    renderForm()
    const name = screen.getByRole('textbox', { name: /Name/ })
    fireEvent.change(name, { target: { value: 'Tablet landscape' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create app' }))

    const notice = await screen.findByRole('alert')
    expect(notice).toHaveTextContent('The container engine is unavailable.')
    expect(within(notice).getByText('Request ID create-123')).toBeVisible()
    expect(name).toHaveValue('Tablet landscape')
    expect(name).not.toHaveAttribute('aria-invalid')
    expect(screen.getByRole('button', { name: 'Create app' })).toBeEnabled()
    expect(push).not.toHaveBeenCalled()
    expect(toast).not.toHaveBeenCalled()
  })

  it('keeps the draft when a success response contains an unusable ID', async () => {
    vi.mocked(submitCreateApplicationAction).mockResolvedValueOnce(actionOk({ id: 'undefined' }, 'create-456'))
    renderForm()
    const name = screen.getByRole('textbox', { name: /Name/ })
    fireEvent.change(name, { target: { value: 'Tablet landscape' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create app' }))

    const notice = await screen.findByRole('alert')
    expect(notice).toHaveTextContent('Check All apps before trying again.')
    expect(notice).toHaveTextContent('Request ID create-456')
    expect(name).toHaveValue('Tablet landscape')
    expect(push).not.toHaveBeenCalled()
    expect(toast).not.toHaveBeenCalled()
  })

  it('opens the app page only after receiving a valid app ID', async () => {
    const appId = '6d8b5e09-e4bf-4568-9aa9-0572237c04d3'
    vi.mocked(submitCreateApplicationAction).mockResolvedValueOnce(actionOk({ id: appId }))
    renderForm()
    fireEvent.change(screen.getByRole('textbox', { name: /Name/ }), { target: { value: 'Tablet landscape' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create app' }))

    await waitFor(() => expect(push).toHaveBeenCalledWith(`/app/${appId}`))
    expect(toast).toHaveBeenCalledWith({
      title: 'App creation started',
      description: 'Track provisioning on the app page.',
      variant: 'success'
    })
  })

  it('reveals an error in the collapsed resource section', async () => {
    vi.mocked(submitCreateApplicationAction).mockResolvedValueOnce(
      actionError({
        message: 'Review the highlighted fields and try again.',
        code: 'validation',
        fieldErrors: { memoryLimitMb: ['RAM limit exceeds your quota.'] }
      })
    )
    renderForm()
    fireEvent.change(screen.getByRole('textbox', { name: /Name/ }), { target: { value: 'Tablet landscape' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create app' }))

    const ram = await screen.findByRole('spinbutton', { name: 'RAM limit' })
    expect(ram).toHaveAccessibleDescription(/RAM limit exceeds your quota/)
    expect(ram).toHaveAttribute('aria-invalid', 'true')
  })

  it.each([
    ['CPU limit', '16', /Enter a value of 8 or less/],
    ['RAM limit', '32768', /Enter a value of 16384 or less/],
    ['CPU limit', '0.15', /Enter a value in increments of 0\.1/]
  ])('validates %s with value %s when submitted before blur', (label, value, message) => {
    renderForm()
    fireEvent.change(screen.getByRole('textbox', { name: /Name/ }), { target: { value: 'Tablet' } })
    fireEvent.click(screen.getByRole('button', { name: /Lifecycle and resources/ }))
    const input = screen.getByRole<HTMLInputElement>('spinbutton', { name: label })
    input.focus()
    fireEvent.change(input, { target: { value } })

    // Implicit submission with Enter submits the form without blurring the field first.
    act(() => input.form?.requestSubmit())

    expect(submitCreateApplicationAction).not.toHaveBeenCalled()
    expect(input).toHaveValue(Number(value))
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription(message)
  })
})
