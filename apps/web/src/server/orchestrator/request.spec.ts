import { beforeEach, describe, expect, it, vi, type MockedFunction } from 'vitest'
import { PublicActionError } from '@/server/errors/public-action-error'

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

const noContentResponse = () => new Response(null, { status: 204 })

const getFetchInit = () => {
  const fetchMock = global.fetch as MockedFunction<typeof fetch>
  return fetchMock.mock.calls.at(-1)?.[1] as RequestInit
}

describe('orchestrator request helpers', () => {
  beforeEach(() => {
    const fetchMock: MockedFunction<typeof fetch> = vi.fn(() => Promise.resolve(okResponse()))
    global.fetch = fetchMock
  })

  it('does not send JSON content-type for bodyless DELETE requests', async () => {
    const { emptyRequest } = await import('./request')

    await emptyRequest('/platform/docker/networks/net-1', { method: 'DELETE' })

    expect(getFetchInit().headers).toMatchObject({ accept: 'application/json' })
    expect(getFetchInit().headers).not.toHaveProperty('content-type')
  })

  it('handles no-content successful responses', async () => {
    const fetchMock: MockedFunction<typeof fetch> = vi.fn(() => Promise.resolve(noContentResponse()))
    global.fetch = fetchMock
    const { requestVoid } = await import('./request')

    await expect(requestVoid('/settings/ai-providers/local-ollama', { method: 'DELETE' })).resolves.toBeUndefined()
  })

  it.each([noContentResponse(), new Response('  ')])('rejects an empty required JSON response', async response => {
    vi.mocked(global.fetch).mockResolvedValue(response)
    const { request } = await import('./request')

    await expect(
      request('/devices', { headers: new Headers({ 'x-request-id': 'required-json' }) })
    ).rejects.toMatchObject({
      status: 502,
      requestId: 'required-json'
    })
  })

  it('uses the response parser before returning data', async () => {
    const { request } = await import('./request')
    const parser = vi.fn(() => {
      throw new Error('Malformed DTO')
    })

    await expect(request('/devices', undefined, parser)).rejects.toMatchObject({ status: 502 })
    expect(parser).toHaveBeenCalledWith({ ok: true })
  })

  it('maps a timeout while reading the body to an upstream timeout with the request ID', async () => {
    const deadline = new AbortController()
    const body = new ReadableStream({
      start(controller) {
        deadline.signal.addEventListener('abort', () => controller.error(new DOMException('Stopped', 'AbortError')))
      }
    })
    vi.mocked(global.fetch).mockResolvedValue(new Response(body))
    const { request } = await import('./request')
    const pending = request('/devices', { signal: deadline.signal, headers: { 'x-request-id': 'body-timeout' } })
    deadline.abort(new DOMException('Timed out', 'TimeoutError'))

    await expect(pending).rejects.toMatchObject({
      name: 'OrchestratorRequestError',
      status: 504,
      requestId: 'body-timeout'
    })
  })

  it('does not send JSON content-type for bodyless POST requests', async () => {
    const { emptyRequest } = await import('./request')

    await emptyRequest('/platform/docker/prune/networks', { method: 'POST' })

    expect(getFetchInit().headers).toMatchObject({ accept: 'application/json' })
    expect(getFetchInit().headers).not.toHaveProperty('content-type')
  })

  it('sends JSON content-type for JSON mutations', async () => {
    const { jsonRequest } = await import('./request')

    await jsonRequest('/devices/app-1', 'PATCH', { name: 'Work' })

    expect(getFetchInit().headers).toMatchObject({
      accept: 'application/json',
      'content-type': 'application/json'
    })
    expect(getFetchInit().body).toBe(JSON.stringify({ name: 'Work' }))
  })

  it('preserves the multipart boundary and body for streamed uploads', async () => {
    const { streamRequest } = await import('./request')
    const body = new ReadableStream<Uint8Array>()
    const contentType = 'multipart/form-data; boundary=upload-boundary'

    await streamRequest('/devices/app-1/runtime/data-files', 'POST', body, contentType)

    expect(getFetchInit().headers).toMatchObject({ 'content-type': contentType })
    expect(getFetchInit()).toMatchObject({ body, duplex: 'half' })
  })

  it('preserves the local validation error when fetch rejects a streaming request body', async () => {
    const { streamRequest } = await import('./request')
    const error = new PublicActionError('Upload too large', { code: 'validation', status: 413 })
    vi.mocked(global.fetch).mockRejectedValue(new TypeError('fetch failed', { cause: error }))

    await expect(streamRequest('/apks', 'POST', new ReadableStream(), 'multipart/form-data')).rejects.toBe(error)
  })

  it('uses upstream validation messages when requests fail', async () => {
    const fetchMock: MockedFunction<typeof fetch> = vi.fn(() =>
      Promise.resolve(errorResponse({ message: ['name is required', 'name is too short'] }))
    )
    global.fetch = fetchMock
    const { emptyRequest } = await import('./request')

    await expect(emptyRequest('/devices')).rejects.toMatchObject({
      name: 'OrchestratorRequestError',
      message: 'name is required, name is too short',
      status: 400,
      requestId: expect.any(String) as string
    })
  })

  it('rejects orchestrator API paths outside the API root', async () => {
    const { getOrchestratorApiUrl } = await import('./config')

    expect(() => getOrchestratorApiUrl('/../internal')).toThrow('Orchestrator API paths cannot escape the API root.')
    expect(() => getOrchestratorApiUrl('//internal')).toThrow('Orchestrator API paths must start with a single slash.')
  })

  it('rejects non-http orchestrator upstream URLs', async () => {
    const previousUrl = process.env.ORCHESTRATOR_API_URL
    process.env.ORCHESTRATOR_API_URL = 'file:///tmp/socket'
    const { getOrchestratorBaseUrl } = await import('./config')

    try {
      expect(() => getOrchestratorBaseUrl()).toThrow('ORCHESTRATOR_API_URL must use http or https.')
    } finally {
      if (previousUrl === undefined) {
        delete process.env.ORCHESTRATOR_API_URL
      } else {
        process.env.ORCHESTRATOR_API_URL = previousUrl
      }
    }
  })
})
