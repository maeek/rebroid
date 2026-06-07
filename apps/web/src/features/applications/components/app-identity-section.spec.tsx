import type { HTMLAttributes } from 'react'
import { describe, expect, it, jest } from '@jest/globals'
import { fireEvent, render, screen } from '@testing-library/react'
import { AppIdentitySection } from './app-identity-section'

jest.mock('@/components/ui/input', () => ({
  Input: (props: Record<string, unknown>) => {
    const inputProps = props as {
      type?: string
      value?: string
    } & HTMLAttributes<HTMLInputElement>
    return (
      <input
        {...inputProps}
        data-testid={inputProps.type === 'file' ? 'apk-input' : 'name-input'}
      />
    )
  }
}))

describe('AppIdentitySection', () => {
  it('shows uploaded apk label and forwards name changes', () => {
    const onNameChange = jest.fn()
    const onApkSelect = jest.fn()

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

    const nameInput = screen.getByTestId('name-input')
    fireEvent.change(nameInput, { target: { value: 'Acme App Updated' } })
    expect(onNameChange).toHaveBeenCalledWith('Acme App Updated')

    const fileInput = screen.getByTestId('apk-input')
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
})
