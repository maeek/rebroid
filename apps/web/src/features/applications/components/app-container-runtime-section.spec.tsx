import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AppContainerRuntimeSection } from './app-container-runtime-section'

describe('AppContainerRuntimeSection', () => {
  it('calls image and arg change callbacks', () => {
    const onContainerImageChange = vi.fn()
    const onContainerArgsChange = vi.fn()

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

  it('shows a copyable image reference in readonly mode', () => {
    render(
      <AppContainerRuntimeSection
        title='Device'
        containerImage='image:readonly'
        containerImageMode='readonly'
        showContainerArgs={false}
      />
    )

    expect(screen.getByText('image:readonly')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Copy Image' })).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).toBeNull()
  })
})
