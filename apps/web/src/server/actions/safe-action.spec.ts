import * as navigation from 'next/navigation'
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { PublicActionError } from '@/server/errors/public-action-error'
import * as requestIds from '@/server/observability/request-id'
import { OrchestratorRequestError } from '@/server/orchestrator/request'

vi.mock('next/navigation', () => ({
  unstable_rethrow: vi.fn()
}))
vi.mock('@/server/observability/request-id', () => ({
  getRequestId: vi.fn(() => Promise.resolve('request-1'))
}))

let consoleErrorSpy: MockInstance<typeof console.error>

beforeEach(() => {
  vi.mocked(requestIds.getRequestId).mockResolvedValue('request-1')
  vi.mocked(navigation.unstable_rethrow).mockImplementation((error: unknown) => {
    if (error instanceof Error && error.message === 'NEXT_REDIRECT') throw error
  })
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  consoleErrorSpy.mockRestore()
})

describe('safe server actions', () => {
  it('returns successful action data', async () => {
    const { runSafeAction } = await import('./safe-action')

    await expect(runSafeAction(() => 'saved')).resolves.toEqual({
      ok: true,
      data: 'saved',
      requestId: 'request-1'
    })
  })

  it('returns specific validation messages', async () => {
    const { runSafeAction } = await import('./safe-action')

    await expect(
      runSafeAction(() => {
        throw new PublicActionError('Current password is incorrect.', { code: 'validation', status: 422 })
      })
    ).resolves.toEqual({
      ok: false,
      requestId: 'request-1',
      error: {
        code: 'validation',
        message: 'Current password is incorrect.',
        requestId: 'request-1',
        status: 422
      }
    })
  })

  it('preserves orchestrator request status without exposing its message', async () => {
    const { runSafeAction } = await import('./safe-action')

    await expect(
      runSafeAction(() => {
        throw new OrchestratorRequestError('Docker image is still used by a container.', 409)
      })
    ).resolves.toEqual({
      ok: false,
      requestId: 'request-1',
      error: {
        code: 'conflict',
        message: 'The action failed. Try again or check the server logs.',
        requestId: 'request-1',
        status: 409
      }
    })
  })

  it('redacts unexpected upstream server messages', async () => {
    const { runSafeAction } = await import('./safe-action')

    await expect(
      runSafeAction(
        () => {
          throw new OrchestratorRequestError('database connection string leaked', 500)
        },
        { fallbackMessage: 'Could not finish action.' }
      )
    ).resolves.toEqual({
      ok: false,
      requestId: 'request-1',
      error: {
        code: 'upstream_error',
        message: 'Could not finish action.',
        requestId: 'request-1',
        status: 500
      }
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
      requestId: 'request-1',
      error: { code: 'internal', message: 'Could not finish action.', requestId: 'request-1' }
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
      requestId: 'request-1',
      error: { code: 'internal', message: 'Could not finish action.', requestId: 'request-1' }
    })
  })

  it('does not infer public visibility from familiar message wording', async () => {
    const { runSafeAction } = await import('./safe-action')

    await expect(
      runSafeAction(
        () => {
          throw new Error('Current password is incorrect.')
        },
        { fallbackMessage: 'Could not finish action.' }
      )
    ).resolves.toEqual({
      ok: false,
      requestId: 'request-1',
      error: { code: 'internal', message: 'Could not finish action.', requestId: 'request-1' }
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
