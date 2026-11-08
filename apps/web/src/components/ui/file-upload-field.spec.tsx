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
})
