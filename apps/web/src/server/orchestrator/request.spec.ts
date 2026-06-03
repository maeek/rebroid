import { describe, expect, it, jest, beforeEach } from '@jest/globals'

const okResponse = (body: unknown = { ok: true }) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  })

const errorResponse = (body: unknown, status = 400) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  })

const getFetchInit = () => {
  const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>
  return fetchMock.mock.calls.at(-1)?.[1] as RequestInit
}

describe('orchestrator request helpers', () => {
  beforeEach(() => {
    const fetchMock: jest.MockedFunction<typeof fetch> = jest.fn(() => Promise.resolve(okResponse()))
    global.fetch = fetchMock
  })

  it('does not send JSON content-type for bodyless DELETE requests', async () => {
    const { emptyRequest } = await import('./request')

    await emptyRequest('/platform/docker/networks/net-1', { method: 'DELETE' })

    expect(getFetchInit().headers).toMatchObject({ accept: 'application/json' })
    expect(getFetchInit().headers).not.toHaveProperty('content-type')
  })

  it('does not send JSON content-type for bodyless POST requests', async () => {
    const { emptyRequest } = await import('./request')

    await emptyRequest('/platform/docker/prune/networks', { method: 'POST' })

    expect(getFetchInit().headers).toMatchObject({ accept: 'application/json' })
    expect(getFetchInit().headers).not.toHaveProperty('content-type')
  })

  it('sends JSON content-type for JSON mutations', async () => {
    const { jsonRequest } = await import('./request')

    await jsonRequest('/apps/app-1', 'PATCH', { name: 'Work' })

    expect(getFetchInit().headers).toMatchObject({
      accept: 'application/json',
      'content-type': 'application/json'
    })
    expect(getFetchInit().body).toBe(JSON.stringify({ name: 'Work' }))
  })

  it('lets the runtime set multipart boundaries for FormData requests', async () => {
    const { formRequest } = await import('./request')
    const form = new FormData()
    form.set('file', new Blob(['hello']), 'hello.txt')

    await formRequest('/apps/app-1/runtime/download-files', 'POST', form)

    expect(getFetchInit().headers).not.toHaveProperty('content-type')
    expect(getFetchInit().body).toBe(form)
  })

  it('uses upstream validation messages when requests fail', async () => {
    const fetchMock: jest.MockedFunction<typeof fetch> = jest.fn(() =>
      Promise.resolve(errorResponse({ message: ['name is required', 'name is too short'] }))
    )
    global.fetch = fetchMock
    const { emptyRequest, OrchestratorRequestError } = await import('./request')

    await expect(emptyRequest('/apps')).rejects.toEqual(
      new OrchestratorRequestError('name is required, name is too short', 400)
    )
  })
})
