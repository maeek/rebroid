import type { ComponentProps } from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { uploadApkWithFeedback } from '@/features/applications/apks/upload-apk-with-feedback'
import { toast } from '@/hooks/use-toast'
import { getBff } from '@/lib/http/bff'
import { setAppIconAction } from '@/server/app-icons/actions/set-app-icon-action'
import { submitCreateApplicationAction } from '@/server/orchestrator/applications/actions/configuration/create-update-actions'
import { actionError, actionOk } from '@/shared/actions/action-result'
import { FeatureFlagsProvider } from '@/shared/model/features/feature-flags-context'
import { optimizeIconFile } from '@/shared/model/media/icon-metadata'
import { defaultOrchestratorUiSettings } from '@/shared/model/settings/orchestrator-ui-settings'
import { appResourcePreviewFeatures } from '../detail/app-resource-preview-data'
import { CreateAppForm } from './create-app-form'
import type { UploadedApk } from '@/shared/contracts/application'
import type { PlatformImage } from '@/shared/contracts/platform'

const { push, topLoader } = vi.hoisted(() => ({
  push: vi.fn(),
  topLoader: { start: vi.fn(), setProgress: vi.fn(), done: vi.fn() }
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }))
vi.mock('@/lib/http/bff', () => ({ getBff: vi.fn() }))
vi.mock('nextjs-toploader', () => ({
  useTopLoader: () => topLoader
}))
vi.mock('@/server/orchestrator/applications/actions/configuration/create-update-actions', () => ({
  submitCreateApplicationAction: vi.fn()
}))
vi.mock('@/server/app-icons/actions/set-app-icon-action', () => ({ setAppIconAction: vi.fn() }))
vi.mock('@/features/applications/apks/upload-apk-with-feedback', () => ({ uploadApkWithFeedback: vi.fn() }))
vi.mock('@/shared/model/media/icon-metadata', () => ({ optimizeIconFile: vi.fn() }))
vi.mock('@/shared/model/settings/use-orchestrator-ui-settings', () => ({
  useOrchestratorUiSettings: (settings: unknown) => settings
}))
vi.mock('@/shared/model/settings/use-resource-limit-bounds', () => ({
  useResourceLimitBounds: () => ({
    maxMemoryMb: 16384,
    maxCpuCpus: 8,
    hostMemoryBytes: 32 * 1024 ** 3,
    hostCpuCores: 12
  })
}))

const renderForm = (firewallEnabled = false, formProps: Partial<ComponentProps<typeof CreateAppForm>> = {}) =>
  render(
    <FeatureFlagsProvider
      manifest={{
        ...appResourcePreviewFeatures,
        features: appResourcePreviewFeatures.features.map(feature =>
          feature.key === 'feature.firewall'
            ? { ...feature, enabled: firewallEnabled, effective: firewallEnabled }
            : feature
        )
      }}
    >
      <CreateAppForm
        images={[]}
        initialSettings={defaultOrchestratorUiSettings}
        permissions={{
          'applications:change-resources': true,
          'applications:change-session-limit': true,
          'applications:configure-egress': true,
          'applications:upload-apk': true
        }}
        canBuildImages={false}
        {...formProps}
      />
    </FeatureFlagsProvider>
  )

describe('Create app failure feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(submitCreateApplicationAction).mockReset()
  })

  it('hides network controls and omits policy fields when Firewall is disabled', async () => {
    vi.mocked(submitCreateApplicationAction).mockResolvedValueOnce(
      actionOk({ id: '6d8b5e09-e4bf-4568-9aa9-0572237c04d3' })
    )
    renderForm()
    expect(screen.queryByText('Network access')).toBeNull()
    fireEvent.change(screen.getByRole('textbox', { name: /Name/ }), { target: { value: 'Tablet' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create app' }))

    await waitFor(() => expect(submitCreateApplicationAction).toHaveBeenCalledTimes(1))
    const input = vi.mocked(submitCreateApplicationAction).mock.calls[0][0]
    expect(input).not.toHaveProperty('networkPolicyEnabled')
    expect(input).not.toHaveProperty('networkPolicyAllowCidrs')
  })

  it('shows network controls when Firewall and egress configuration are available', () => {
    renderForm(true)
    expect(screen.getByText('Network access')).toBeVisible()
  })

  it('shows Google Play support beneath the picker after choosing the recommended image', () => {
    const images = (['none', 'gapps'] as const).map((gmsMode): PlatformImage => ({
      id: gmsMode,
      shortId: gmsMode,
      repoTags: [`local/${gmsMode}:14`],
      repoDigests: [],
      sizeBytes: 1,
      sharedSizeBytes: 0,
      virtualSizeBytes: 1,
      createdAt: '',
      labels: {},
      managed: true,
      containers: 0,
      runtimeMetadataSource: 'stored',
      runtimeMetadata: {
        runtimeKind: 'redroid',
        androidVersion: '14',
        architecture: 'amd64',
        gmsMode,
        signatureSpoofing: 'not_applicable'
      }
    }))
    renderForm(false, {
      images,
      initialContainerImage: 'local/none:14',
      permissions: { 'applications:change-base-image': true },
      initialUploadedApk: {
        id: 'apk-1',
        ownerUserId: null,
        originalName: 'app.apk',
        sha256: '',
        sizeBytes: 10,
        extractedIconDataUrl: null,
        displayName: 'Android app',
        packageName: null,
        googlePlayServices: { verdict: 'required', evidence: ['manifest_gms_version'], analysisVersion: 1 },
        createdAt: '',
        updatedAt: ''
      }
    })
    const picker = screen.getByRole('combobox', { name: 'Runtime image' })
    expect(screen.getByText('Google Play services required')).toBeVisible()
    expect(screen.queryByText('Google Play services included')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Use recommended image' }))

    expect(picker).toHaveValue('local/gapps:14')
    expect(picker).toHaveAccessibleDescription(/Google Play services included/)
    expect(screen.getByText('Google Play services included')).toBeVisible()
    expect(screen.queryByText('Google Play services required')).not.toBeInTheDocument()
  })

  it('keeps the selected APK and icon when a dropped replacement fails', async () => {
    const transfer = Promise.withResolvers<void>()
    const inspection = Promise.withResolvers<void>()
    vi.mocked(uploadApkWithFeedback)
      .mockResolvedValueOnce({
        id: 'apk-1',
        ownerUserId: null,
        originalName: 'original.apk',
        sha256: '',
        sizeBytes: 10,
        extractedIconDataUrl: 'data:image/png;base64,AA==',
        displayName: 'Original app',
        packageName: null,
        googlePlayServices: { verdict: 'not_detected', evidence: [], analysisVersion: 1 },
        createdAt: '',
        updatedAt: ''
      })
      .mockImplementationOnce(async ({ onError, onProgress }) => {
        onProgress?.(42)
        await transfer.promise
        onProgress?.(100)
        await inspection.promise
        onError?.('Choose a valid APK file.')
        return null
      })
    renderForm()
    const picker = screen.getByLabelText('APK file', { exact: true })
    fireEvent.change(picker, { target: { files: [new File(['apk'], 'original.apk')] } })
    expect(await screen.findByText('Icon from APK')).toBeVisible()
    expect(screen.getByRole('textbox', { name: /Name/ })).toHaveValue('Original app')
    expect(screen.getByRole('button', { name: 'Create app' })).toBeEnabled()

    const replacement = new File(['apk'], 'replacement.apk')
    fireEvent.drop(picker, {
      dataTransfer: { types: ['Files'], files: [replacement] }
    })
    const progress = screen.getByRole('progressbar', { name: 'File upload progress' })
    expect(progress).toHaveAttribute('aria-valuenow', '42')
    expect(screen.getByText('42%')).toBeVisible()
    expect(topLoader.start).not.toHaveBeenCalled()
    expect(topLoader.setProgress).not.toHaveBeenCalled()
    expect(topLoader.done).not.toHaveBeenCalled()

    await act(async () => {
      transfer.resolve()
      await transfer.promise
    })
    expect(progress).toHaveAttribute('aria-valuenow', '100')
    expect(screen.getByText('Processing APK… replacement.apk')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Create app' })).toBeDisabled()

    await act(async () => {
      inspection.resolve()
      await inspection.promise
    })
    expect(await screen.findByText('Choose a valid APK file.')).toBeVisible()
    expect(screen.queryByRole('progressbar')).toBeNull()
    expect(screen.getByText('original.apk')).toBeVisible()
    expect(screen.getByRole('switch', { name: 'Use icon from APK' })).toBeChecked()
  })

  it('waits for icon preparation and keeps the current icon on failure', async () => {
    const icon = 'data:image/png;base64,AA=='
    vi.mocked(optimizeIconFile).mockResolvedValueOnce(icon).mockRejectedValueOnce(new Error('Choose another image.'))
    renderForm()
    const picker = screen.getByLabelText('App icon', { exact: true })
    const submit = screen.getByRole('button', { name: 'Create app' })
    const file = new File(['image'], 'icon.png', { type: 'image/png' })

    fireEvent.change(screen.getByRole('textbox', { name: /Name/ }), { target: { value: 'Tablet' } })
    expect(submit).toBeEnabled()
    fireEvent.change(picker, { target: { files: [file] } })
    expect(submit).toBeDisabled()
    expect(await screen.findByText('Custom icon')).toBeVisible()
    expect(submit).toBeEnabled()

    fireEvent.change(picker, { target: { files: [file] } })
    expect(await screen.findByText('Choose another image.')).toBeVisible()
    expect(screen.getByText('Custom icon')).toBeVisible()
    expect(optimizeIconFile).toHaveBeenCalledTimes(2)
  })

  it('includes pasted IPv4 destinations when Create app is the next action', async () => {
    vi.mocked(submitCreateApplicationAction).mockResolvedValueOnce(
      actionOk({ id: '6d8b5e09-e4bf-4568-9aa9-0572237c04d3' })
    )
    renderForm(true)
    fireEvent.change(screen.getByRole('textbox', { name: /Name/ }), { target: { value: 'Tablet' } })
    fireEvent.change(screen.getByRole('textbox', { name: 'Additional IPv4 destinations' }), {
      target: { value: '192.0.2.10\n10.0.0.0/16' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create app' }))

    await waitFor(() =>
      expect(submitCreateApplicationAction).toHaveBeenCalledWith(
        expect.objectContaining({
          networkPolicyEnabled: true,
          networkPolicyAllowCidrs: ['192.0.2.10/32', '10.0.0.0/16']
        })
      )
    )
  })

  it('requires a name with at least two characters after trimming', () => {
    renderForm()
    const submit = screen.getByRole('button', { name: 'Create app' })
    const name = screen.getByRole('textbox', { name: /Name/ })
    expect(submit).toBeDisabled()
    expect(name).not.toHaveAttribute('aria-invalid')

    for (const value of ['   ', ' A ']) {
      fireEvent.change(name, { target: { value } })
      expect(submit).toBeDisabled()
      expect(name).toHaveAccessibleDescription(/Enter a name with at least 2 characters/)
    }

    fireEvent.change(name, { target: { value: ' AB ' } })
    expect(submit).toBeEnabled()
    expect(name).not.toHaveAttribute('aria-invalid')
    fireEvent.change(name, { target: { value: '' } })
    expect(submit).toBeDisabled()
    expect(name).toHaveAccessibleDescription(/Enter a name with at least 2 characters/)
  })

  it('shows and links to a field error if an invalid draft reaches the submit handler', () => {
    renderForm()
    const name = screen.getByRole<HTMLInputElement>('textbox', { name: /Name/ })
    act(() => name.form?.requestSubmit())
    expect(name).toHaveAccessibleDescription(/Enter a name with at least 2 characters/)
    fireEvent.click(screen.getByRole('button', { name: 'Go to first error' }))
    expect(name).toHaveFocus()
    expect(submitCreateApplicationAction).not.toHaveBeenCalled()
  })

  it('requires valid additional destinations when restricted network access is enabled', () => {
    renderForm(true)
    const submit = screen.getByRole('button', { name: 'Create app' })
    fireEvent.change(screen.getByRole('textbox', { name: /Name/ }), { target: { value: 'Tablet' } })
    const destinations = screen.getByRole('textbox', { name: 'Additional IPv4 destinations' })

    fireEvent.change(destinations, { target: { value: '192.0.2.999' } })
    expect(submit).toBeDisabled()
    expect(destinations).toHaveAccessibleDescription(/invalid IPv4 address or range/)
    fireEvent.change(destinations, { target: { value: '192.0.2.10' } })
    expect(submit).toBeEnabled()
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

  it('keeps the name, saved APK, and custom icon for retry after an unusable app ID', async () => {
    const savedApk: UploadedApk = {
      id: 'saved',
      ownerUserId: null,
      originalName: 'stockroom.apk',
      displayName: 'Stockroom',
      packageName: 'com.example.stockroom',
      sha256: '',
      sizeBytes: 2048,
      extractedIconDataUrl: 'data:image/png;base64,AA==',
      googlePlayServices: { verdict: 'not_detected', evidence: [], analysisVersion: 1 },
      createdAt: '',
      updatedAt: ''
    }
    const appId = '6d8b5e09-e4bf-4568-9aa9-0572237c04d3'
    const customIcon = 'data:image/png;base64,AQ=='
    vi.mocked(getBff).mockResolvedValueOnce([savedApk]).mockResolvedValueOnce(savedApk)
    vi.mocked(optimizeIconFile).mockResolvedValueOnce(customIcon)
    vi.mocked(submitCreateApplicationAction)
      .mockResolvedValueOnce(actionOk({ id: 'undefined' }, 'create-456'))
      .mockResolvedValueOnce(actionOk({ id: appId }))
    vi.mocked(setAppIconAction).mockResolvedValueOnce(actionOk(customIcon))

    renderForm()
    fireEvent.click(screen.getByRole('button', { name: 'Saved APKs' }))
    const dialog = within(screen.getByRole('dialog', { name: 'Choose a saved APK' }))
    fireEvent.click(await dialog.findByRole('option', { name: /Stockroom/ }))
    fireEvent.click(dialog.getByRole('button', { name: 'Use APK' }))
    expect(await screen.findByText('Icon from APK')).toBeVisible()

    const name = screen.getByRole('textbox', { name: /Name/ })
    expect(name).toHaveValue('Stockroom')
    fireEvent.change(name, { target: { value: 'Tablet landscape' } })
    fireEvent.change(screen.getByLabelText('App icon', { exact: true }), {
      target: { files: [new File(['image'], 'icon.png', { type: 'image/png' })] }
    })
    expect(await screen.findByText('Custom icon')).toBeVisible()
    const submit = screen.getByRole('button', { name: 'Create app' })
    fireEvent.click(submit)

    const notice = await screen.findByRole('alert')
    expect(notice).toHaveTextContent('Check All apps before trying again.')
    expect(notice).toHaveTextContent('Request ID create-456')
    expect(name).toHaveValue('Tablet landscape')
    expect(screen.getByText('stockroom.apk')).toBeVisible()
    expect(screen.getByText('Custom icon')).toBeVisible()
    expect(setAppIconAction).not.toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()
    expect(toast).not.toHaveBeenCalled()

    fireEvent.click(submit)
    await waitFor(() => expect(push).toHaveBeenCalledExactlyOnceWith(`/app/${appId}`))
    expect(submitCreateApplicationAction).toHaveBeenCalledTimes(2)
    expect(submitCreateApplicationAction).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ name: 'Tablet landscape', uploadedApkId: savedApk.id })
    )
    expect(setAppIconAction).toHaveBeenCalledExactlyOnceWith(appId, customIcon)
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
    expect(ram).toHaveAccessibleDescription(/Host total 32 GiB/)
    expect(ram).toHaveAttribute('aria-invalid', 'true')
  })

  it('focuses and marks the Name input when the owner already has that app name', async () => {
    const message = 'This owner already has an app with that name. Enter a different name.'
    vi.mocked(submitCreateApplicationAction).mockResolvedValueOnce(
      actionError({ message, code: 'conflict', fieldErrors: { name: [message] } })
    )
    renderForm()
    const name = screen.getByRole('textbox', { name: /Name/ })
    fireEvent.change(name, { target: { value: 'Test app' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create app' }))

    await waitFor(() => expect(name).toHaveFocus())
    expect(name).toHaveAttribute('aria-invalid', 'true')
    expect(name).toHaveValue('Test app')
    expect(push).not.toHaveBeenCalled()
  })

  it.each([
    ['CPU limit', '16', /Enter a value of 8 or less/, ''],
    ['RAM limit', '32768', /Enter a value of 16384 or less/, ''],
    ['CPU limit', '0.15', /Enter a value in increments of 0\.1/, ''],
    ['Inactivity timeout', '86401', /Enter a value of 86400 or less/, '-1'],
    ['Inactivity timeout', '', /Enter a value\./, '0']
  ])('validates %s with value %s when submitted before blur', (label, value, message, corrected) => {
    renderForm()
    fireEvent.change(screen.getByRole('textbox', { name: /Name/ }), { target: { value: 'Tablet' } })
    fireEvent.click(screen.getByRole('button', { name: /Lifecycle and resources/ }))
    const input = screen.getByRole<HTMLInputElement>('spinbutton', { name: label })
    const submit = screen.getByRole('button', { name: 'Create app' })
    input.focus()
    fireEvent.change(input, { target: { value } })
    expect(submit).toBeDisabled()

    // Implicit submission with Enter submits the form without blurring the field first.
    act(() => input.form?.requestSubmit())

    expect(submitCreateApplicationAction).not.toHaveBeenCalled()
    expect(screen.getByText('Review the highlighted fields and try again.')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Go to first error' }))
    expect(input).toHaveFocus()
    expect(input).toHaveValue(value === '' ? null : Number(value))
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription(message)
    fireEvent.change(input, { target: { value: corrected } })
    expect(submit).toBeEnabled()
  })
})
