import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { NetworkAccessInput } from './network-access-input'

describe('NetworkAccessInput', () => {
  it('adds normalized CIDRs and removes existing CIDRs', () => {
    const onAddCidr = vi.fn()
    const onRemoveCidr = vi.fn()

    render(
      <NetworkAccessInput
        cidrs={['10.0.0.0/16']}
        onAddCidr={onAddCidr}
        onRemoveCidr={onRemoveCidr}
        onInvalidCidr={() => {}}
      />
    )

    const input = screen.getByPlaceholderText('Add CIDR and press Enter')
    fireEvent.change(input, { target: { value: '192.168.1.10' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.click(screen.getByRole('button', { name: 'Remove 10.0.0.0/16' }))

    expect(onAddCidr).toHaveBeenCalledWith('192.168.1.10/32')
    expect(onRemoveCidr).toHaveBeenCalledWith('10.0.0.0/16')
  })

  it('reports invalid CIDR input', () => {
    const onInvalidCidr = vi.fn()

    render(
      <NetworkAccessInput
        cidrs={[]}
        onAddCidr={() => {}}
        onRemoveCidr={() => {}}
        onInvalidCidr={onInvalidCidr}
      />
    )

    const input = screen.getByPlaceholderText('Add CIDR and press Enter')
    fireEvent.change(input, { target: { value: 'bad-range' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onInvalidCidr).toHaveBeenCalledWith('bad-range')
  })
})
