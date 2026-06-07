import { describe, expect, it, jest } from '@jest/globals'
import { fireEvent, render, screen } from '@testing-library/react'
import { AppNetworkPolicyEditorSection } from './app-network-policy-editor-section'

jest.mock('@/features/applications/viewer/app-info/network-access-input', () => ({
  NetworkAccessInput: ({
    onAddCidr,
    onRemoveCidr,
    onInvalidCidr,
    cidrs
  }: {
    onAddCidr: (cidr: string) => void
    onRemoveCidr: (cidr: string) => void
    onInvalidCidr: (value: string) => void
    cidrs: string[]
  }) => (
    <div>
      <button
        type='button'
        onClick={() => onAddCidr('10.0.0.0/16')}
      >
        add
      </button>
      <button
        type='button'
        onClick={() => onRemoveCidr('192.168.1.1/24')}
      >
        remove
      </button>
      <button
        type='button'
        onClick={() => onInvalidCidr('bad-range')}
      >
        invalid
      </button>
      <p>cidrs:{cidrs.join(',')}</p>
    </div>
  )
}))

describe('AppNetworkPolicyEditorSection', () => {
  it('wires mode and policy callbacks', () => {
    const onAddCidr = jest.fn()
    const onRemoveCidr = jest.fn()
    const onInvalidCidr = jest.fn()

    render(
      <AppNetworkPolicyEditorSection
        title='Network access'
        modeValue={true}
        onModeChange={() => {}}
        allowCidrs={['192.168.1.1/24']}
        onAddCidr={onAddCidr}
        onRemoveCidr={onRemoveCidr}
        onInvalidCidr={onInvalidCidr}
        sectionDescription='description'
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'add' }))
    fireEvent.click(screen.getByRole('button', { name: 'remove' }))
    fireEvent.click(screen.getByRole('button', { name: 'invalid' }))
    expect(onAddCidr).toHaveBeenCalledWith('10.0.0.0/16')
    expect(onRemoveCidr).toHaveBeenCalledWith('192.168.1.1/24')
    expect(onInvalidCidr).toHaveBeenCalledWith('bad-range')
    expect(screen.getByText('description').textContent).toBe('description')
  })
})
