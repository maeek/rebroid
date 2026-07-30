// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { GroupsSettings } from './groups-settings'
import type { UserGroup } from '@/shared/contracts/auth-user'

vi.mock('next/navigation', () => ({
  usePathname: () => '/security/groups',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams()
}))

const groups: UserGroup[] = [
  {
    id: 'admins',
    name: 'Administrators',
    description: 'Full platform access.',
    role: 'admin',
    permissions: {},
    quotas: {
      maxOpenApps: null,
      maxSessionSeconds: null,
      maxMemoryMb: null,
      maxCpuCpus: null
    },
    createdAt: '2026-07-30T00:00:00.000Z',
    updatedAt: '2026-07-30T00:00:00.000Z'
  },
  {
    id: 'users',
    name: 'Users',
    description: 'Standard app owners with bounded resources.',
    role: 'user',
    permissions: {},
    quotas: {
      maxOpenApps: 2,
      maxSessionSeconds: 3600,
      maxMemoryMb: 4096,
      maxCpuCpus: 2
    },
    createdAt: '2026-07-30T00:00:00.000Z',
    updatedAt: '2026-07-30T00:00:00.000Z'
  }
]

describe('GroupsSettings', () => {
  it('renders the group grid and creation action', () => {
    render(<GroupsSettings initialGroups={groups} />)

    expect(screen.getByRole('heading', { name: 'Groups', level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'New group' })).toBeInTheDocument()
    expect(screen.getByText('Administrators')).toBeInTheDocument()
    expect(screen.getByText('Users')).toBeInTheDocument()
  })
})
