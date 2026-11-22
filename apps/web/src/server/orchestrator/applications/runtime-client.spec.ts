import { afterEach, expect, it, vi } from 'vitest'
import { toActionError } from '@/server/actions/safe-action'
import { orchestratorAppRuntimeClient } from './runtime-client'

afterEach(() => vi.unstubAllGlobals())

it.each([
  ['runtime_file_exists', 'runtime_file_exists'],
  ['runtime_busy', 'conflict']
])('translates upload conflict %s into the public result', async (upstreamCode, publicCode) => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(Response.json({ code: upstreamCode, message: 'private diagnostic' }, { status: 409 }))
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
  expect(error).toMatchObject({ code: publicCode, status: 409, requestId: 'fixture' })
  expect(error.message).not.toContain('private diagnostic')
})
