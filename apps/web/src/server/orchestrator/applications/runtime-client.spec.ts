import { afterEach, expect, it, vi } from 'vitest'
import { toActionError } from '@/server/actions/safe-action'
import { orchestratorAppRuntimeClient } from './runtime-client'

afterEach(() => vi.unstubAllGlobals())

it.each([
  [409, 'runtime_file_exists', 'runtime_file_exists'],
  [409, 'runtime_busy', 'conflict'],
  [413, 'too_large', 'validation']
] as const)('translates upload failure %s/%s into the public result', async (status, upstreamCode, publicCode) => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(Response.json({ code: upstreamCode, message: 'private diagnostic' }, { status }))
  )
  const result = orchestratorAppRuntimeClient.uploadDataFileStream(
    '00000000-0000-4000-8000-000000000001',
    new ReadableStream(),
    '/data',
    'multipart/form-data'
  )
  const error = await result.then(
    () => {
      throw new Error('Expected upload failure')
    },
    (cause: unknown) => toActionError(cause, 'fixture')
  )
  expect(error).toMatchObject({ code: publicCode, status, requestId: 'fixture' })
  expect(error.message).not.toContain('private diagnostic')
})
