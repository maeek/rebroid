import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FileUploadField } from './file-upload-field'
import { FormField } from './form-field'

describe('FileUploadField', () => {
  it('reports selected files and associates feedback with the picker', () => {
    const onChange = vi.fn()
    render(
      <FormField
        label='APK'
        description='Android package'
        error='Upload failed'
        layout='vertical'
      >
        <FileUploadField onChange={onChange} />
      </FormField>
    )
    fireEvent.change(screen.getByLabelText('APK'), { target: { files: [new File(['apk'], 'application.apk')] } })
    expect(onChange).toHaveBeenCalledOnce()
    expect(screen.getByRole('status')).toHaveTextContent('application.apk')
    expect(screen.getByRole('button', { name: 'Choose file' })).toHaveAttribute('aria-invalid', 'true')
  })
  it('prevents repeat uploads while pending', () => {
    render(<FileUploadField pending />)
    expect(screen.getByRole('button', { name: 'Uploading…' })).toBeDisabled()
  })
  it('keeps visible button text fixed and uses the controlled filename after processing', () => {
    const { rerender } = render(<FileUploadField filenameLabel='Current APK' />)
    rerender(
      <FileUploadField
        pending
        filenameLabel='Replacement APK'
      />
    )
    expect(screen.getByRole('button', { name: 'Uploading…' })).toHaveTextContent('Choose file')
    expect(screen.getByRole('status')).toHaveTextContent('Uploading… Replacement APK')
    rerender(<FileUploadField filenameLabel='Current APK' />)
    expect(screen.getByRole('button', { name: 'Choose file' })).toBeEnabled()
    expect(screen.getByRole('status')).toHaveTextContent('Current APK')
  })
  it('uses a newly supplied filename when a drop follows a previous picker selection', () => {
    const { rerender } = render(
      <FormField label='File'>
        <FileUploadField />
      </FormField>
    )
    fireEvent.change(screen.getByLabelText('File'), { target: { files: [new File(['apk'], 'previous.apk')] } })
    rerender(
      <FormField label='File'>
        <FileUploadField
          pending
          filenameLabel='dropped.apk'
        />
      </FormField>
    )
    expect(screen.getByRole('status')).toHaveTextContent('Uploading… dropped.apk')
  })
})
