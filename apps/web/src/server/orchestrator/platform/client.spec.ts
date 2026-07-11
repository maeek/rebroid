import { beforeEach, describe, expect, it, vi, type MockedFunction } from 'vitest'
import { orchestratorPlatformClient } from './client'

const okResponse = (body: unknown = { id: 'resource-1', removed: true }) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  })

const lastFetch = () => {
  const fetchMock = global.fetch as MockedFunction<typeof fetch>
  return fetchMock.mock.calls.at(-1) as [RequestInfo | URL, RequestInit]
}

const urlString = (url: RequestInfo | URL) => {
  if (typeof url === 'string') return url
  if (url instanceof URL) return url.toString()
  return url.url
}

describe('orchestrator platform client', () => {
  beforeEach(() => {
    const fetchMock: MockedFunction<typeof fetch> = vi.fn(() => Promise.resolve(okResponse()))
    global.fetch = fetchMock
  })

  it('removes networks with a bodyless platform DELETE request', async () => {
    await orchestratorPlatformClient.removePlatformNetwork('network-1')

    const [url, init] = lastFetch()
    expect(urlString(url)).toContain('/api/v1/platform/docker/networks/network-1')
    expect(init.method).toBe('DELETE')
    expect(init.body).toBeUndefined()
    expect(init.headers).not.toHaveProperty('content-type')
  })

  it('removes images with a bodyless platform DELETE request', async () => {
    await orchestratorPlatformClient.removePlatformImage('redroid/redroid:latest', true)

    const [url, init] = lastFetch()
    expect(urlString(url)).toContain('/api/v1/platform/docker/images/redroid%2Fredroid%3Alatest?force=true')
    expect(init.method).toBe('DELETE')
    expect(init.body).toBeUndefined()
    expect(init.headers).not.toHaveProperty('content-type')
  })

  it('removes containers with a bodyless platform DELETE request', async () => {
    await orchestratorPlatformClient.removePlatformContainer('container-1', false)

    const [url, init] = lastFetch()
    expect(urlString(url)).toContain('/api/v1/platform/docker/containers/container-1?force=false')
    expect(init.method).toBe('DELETE')
    expect(init.body).toBeUndefined()
    expect(init.headers).not.toHaveProperty('content-type')
  })
})
