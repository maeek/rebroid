import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import { OrchestratorRequestError } from '@/server/orchestrator/request'

jest.mock('next/navigation', () => ({
  unstable_rethrow: jest.fn()
}))

const navigation = jest.requireMock<typeof import('next/navigation')>('next/navigation')
let consoleErrorSpy: jest.SpiedFunction<typeof console.error>

beforeEach(() => {
  jest.mocked(navigation.unstable_rethrow).mockImplementation((error: unknown) => {
    if (error instanceof Error && error.message === 'NEXT_REDIRECT') throw error
  })
  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  consoleErrorSpy.mockRestore()
})

describe('safe server actions', () => {
  it('returns successful action data', async () => {
    const { runSafeAction } = await import('./safe-action')

    await expect(runSafeAction(() => 'saved')).resolves.toEqual({ ok: true, data: 'saved' })
  })

  it('returns specific validation messages', async () => {
    const { runSafeAction } = await import('./safe-action')

    await expect(
      runSafeAction(() => {
        throw new Error('Current password is incorrect.')
      })
    ).resolves.toEqual({
      ok: false,
      error: { message: 'Current password is incorrect.' }
    })
  })

  it('preserves orchestrator request status', async () => {
    const { runSafeAction } = await import('./safe-action')

    await expect(
      runSafeAction(() => {
        throw new OrchestratorRequestError('Docker image is still used by a container.', 409)
      })
    ).resolves.toEqual({
      ok: false,
      error: { message: 'Docker image is still used by a container.', status: 409 }
    })
  })

  it('falls back for production digest messages', async () => {
    const { runSafeAction } = await import('./safe-action')

    await expect(
      runSafeAction(
        () => {
          throw new Error(
            'An error occurred in the Server Components render. The specific message is omitted in production builds to avoid leaking sensitive details.'
          )
        },
        { fallbackMessage: 'Could not finish action.' }
      )
    ).resolves.toEqual({
      ok: false,
      error: { message: 'Could not finish action.' }
    })
  })

  it('redacts unexpected server error messages', async () => {
    const { runSafeAction } = await import('./safe-action')

    await expect(
      runSafeAction(
        () => {
          throw new Error('database password is secret')
        },
        { fallbackMessage: 'Could not finish action.' }
      )
    ).resolves.toEqual({
      ok: false,
      error: { message: 'Could not finish action.' }
    })
  })

  it('rethrows Next navigation errors', async () => {
    const { runSafeAction } = await import('./safe-action')

    await expect(
      runSafeAction(() => {
        throw new Error('NEXT_REDIRECT')
      })
    ).rejects.toThrow('NEXT_REDIRECT')
  })
})
