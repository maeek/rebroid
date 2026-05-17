import { getOrchestratorBaseUrl } from '@/lib/orchestrator/config'

const secretHeaderName = 'x-orchestrator-secret'
const orchestratorSharedSecret = process.env.ORCHESTRATOR_SHARED_SECRET?.trim()

const apiUrl = (path: string) => `${getOrchestratorBaseUrl().replace(/\/$/, '')}${path}`

const getErrorMessage = (error: unknown, fallback: string) => {
  if (!error || typeof error !== 'object' || !('message' in error)) {
    return fallback
  }

  const message = error.message
  if (Array.isArray(message)) {
    return message.join(', ')
  }

  return typeof message === 'string' ? message : fallback
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), {
    ...init,
    cache: 'no-store',
    headers: {
      accept: 'application/json',
      ...(init?.body instanceof FormData ? {} : { 'content-type': 'application/json' }),
      ...(orchestratorSharedSecret ? { [secretHeaderName]: orchestratorSharedSecret } : {}),
      ...init?.headers
    }
  })

  if (!response.ok) {
    const error: unknown = await response.json().catch(() => ({ message: response.statusText }))
    throw new Error(getErrorMessage(error, response.statusText))
  }

  return response.json() as Promise<T>
}
