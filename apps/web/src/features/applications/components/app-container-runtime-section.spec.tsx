import { describe, expect, it, jest } from '@jest/globals'
import { fireEvent, render, screen } from '@testing-library/react'
import { AppContainerRuntimeSection } from './app-container-runtime-section'

describe('AppContainerRuntimeSection', () => {
  it('calls image and arg change callbacks', () => {
    const onContainerImageChange = jest.fn()
    const onContainerArgsChange = jest.fn()

    render(
      <AppContainerRuntimeSection
        title='Device'
        containerImage='image:base'
        onContainerImageChange={onContainerImageChange}
        containerArgsValue='--flag'
        onContainerArgsChange={onContainerArgsChange}
      />
    )

    fireEvent.change(screen.getByDisplayValue('image:base'), {
      target: { value: 'image:updated' }
    })
    fireEvent.change(screen.getByDisplayValue('--flag'), {
      target: { value: '--other' }
    })

    expect(onContainerImageChange).toHaveBeenCalledWith('image:updated')
    expect(onContainerArgsChange).toHaveBeenCalledWith('--other')
  })

  it('renders readonly image field when editability is disabled', () => {
    render(
      <AppContainerRuntimeSection
        title='Device'
        containerImage='image:readonly'
        containerImageMode='readonly'
        showContainerArgs={false}
      />
    )

    const imageInput = screen.getByDisplayValue('image:readonly')
    expect((imageInput as HTMLInputElement).readOnly).toBe(true)
    expect(screen.queryByDisplayValue('--')).toBeNull()
  })
})
