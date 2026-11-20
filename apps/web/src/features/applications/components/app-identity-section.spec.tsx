import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { getBff } from '@/lib/http/bff'
import { AppIdentitySection } from './app-identity-section'

vi.mock('@/lib/http/bff', () => ({ getBff: vi.fn() }))

describe('AppIdentitySection', () => {
  it('shows uploaded apk label and forwards name changes', () => {
    const onNameChange = vi.fn()
    const onApkSelect = vi.fn()

    render(
      <AppIdentitySection
        valuesName='Acme App'
        onNameChange={onNameChange}
        uploadedApkLabel='Uploaded acme.apk · 3.14 MB'
        isUploadingApk={false}
        onApkSelect={onApkSelect}
      />
    )

    expect(screen.getByText('Uploaded acme.apk · 3.14 MB').textContent).toBe('Uploaded acme.apk · 3.14 MB')

    const nameInput = screen.getByRole('textbox', { name: /Name/ })
    fireEvent.change(nameInput, { target: { value: 'Acme App Updated' } })
    expect(onNameChange).toHaveBeenCalledWith('Acme App Updated')

    const fileInput = screen.getByLabelText('APK file', { exact: true })
    const apk = new File(['payload'], 'acme.apk', {
      type: 'application/vnd.android.package-archive'
    })
    const files = { 0: apk, item: () => apk, length: 1 } as unknown as FileList
    fireEvent.change(fileInput, { target: { files } })
    expect(onApkSelect).toHaveBeenCalledWith(apk)
  })

  it('renders icon slot when provided', () => {
    render(
      <AppIdentitySection
        valuesName='Widget'
        onNameChange={() => {}}
        isUploadingApk={false}
        onApkSelect={() => {}}
        iconSlot={<div>Icon placeholder</div>}
      />
    )

    expect(screen.getByText('Icon placeholder').textContent).toBe('Icon placeholder')
  })

  it('offers an upload and shows saved APK choices as soon as the picker opens', async () => {
    const saved = {
      id: 'saved',
      displayName: 'Stockroom',
      originalName: 'stockroom.apk',
      packageName: 'com.example.stockroom',
      sizeBytes: 2048
    }
    vi.mocked(getBff).mockResolvedValueOnce([saved]).mockResolvedValueOnce(saved)
    const onSavedApkSelect = vi.fn()
    render(
      <AppIdentitySection
        valuesName='Warehouse'
        onNameChange={() => {}}
        isUploadingApk={false}
        onApkSelect={() => {}}
        onSavedApkSelect={onSavedApkSelect}
      />
    )

    expect(screen.getByRole('button', { name: 'Upload APK' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Choose saved APK' }))
    const dialog = within(screen.getByRole('dialog', { name: 'Choose a saved APK' }))
    fireEvent.click(await dialog.findByRole('option', { name: /Stockroom/ }))
    fireEvent.click(dialog.getByRole('button', { name: 'Use APK' }))
    await waitFor(() => expect(onSavedApkSelect).toHaveBeenCalledWith(saved))
  })
})
