import { beforeEach, describe, expect, it, vi } from 'vitest'
import { assertCanManageApplicationFiles, assertCanTransferApplicationFiles } from './runtime-file-access'

const mocks = vi.hoisted(() => ({
  assertCanUseOwnedApplicationRuntime: vi.fn()
}))

vi.mock('./actions/common/action-helpers', () => ({
  assertCanUseOwnedApplicationRuntime: mocks.assertCanUseOwnedApplicationRuntime,
  ownedRuntimeMessage: 'Open this app as your own copy.'
}))

const context = (role: 'admin' | 'user', permissions: Record<string, boolean>) => ({
  app: { id: 'app-1', name: 'Demo' },
  user: { ownerUserId: 'user-1', role, permissions }
})

describe('runtime file access', () => {
  beforeEach(() => mocks.assertCanUseOwnedApplicationRuntime.mockReset())

  it('requires transfer permission for listing, preview, upload, and download access', async () => {
    mocks.assertCanUseOwnedApplicationRuntime.mockResolvedValue(context('user', {}))

    await expect(assertCanTransferApplicationFiles('app-1')).rejects.toMatchObject({
      code: 'forbidden',
      status: 403
    })

    mocks.assertCanUseOwnedApplicationRuntime.mockResolvedValue(
      context('user', { 'applications:transfer-files': true })
    )
    await expect(assertCanTransferApplicationFiles('app-1')).resolves.toMatchObject({ app: { id: 'app-1' } })
  })

  it('requires the explicitly granted manage-files permission for mutations', async () => {
    mocks.assertCanUseOwnedApplicationRuntime.mockResolvedValue(
      context('user', { 'applications:transfer-files': true })
    )

    await expect(assertCanManageApplicationFiles('app-1')).rejects.toMatchObject({
      code: 'forbidden',
      status: 403
    })

    mocks.assertCanUseOwnedApplicationRuntime.mockResolvedValue(context('user', { 'applications:manage-files': true }))
    await expect(assertCanManageApplicationFiles('app-1')).resolves.toMatchObject({ app: { id: 'app-1' } })
  })

  it('lets administrators bypass both file permissions after ownership checking', async () => {
    mocks.assertCanUseOwnedApplicationRuntime.mockResolvedValue(context('admin', {}))

    await expect(assertCanTransferApplicationFiles('app-1')).resolves.toBeDefined()
    await expect(assertCanManageApplicationFiles('app-1')).resolves.toBeDefined()
    expect(mocks.assertCanUseOwnedApplicationRuntime).toHaveBeenCalledTimes(2)
  })
})
