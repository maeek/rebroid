import { getOrchestratorBaseUrl } from '@/server/orchestrator/config'

const secretHeaderName = 'x-orchestrator-secret'
const orchestratorSharedSecret = process.env.ORCHESTRATOR_SHARED_SECRET?.trim()

const apiUrl = (path: string) => `${getOrchestratorBaseUrl().replace(/\/$/, '')}/api/v1${path}`

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

export class OrchestratorRequestError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
    this.name = 'OrchestratorRequestError'
  }
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(apiUrl(path), {
      ...init,
      cache: 'no-store',
      headers: {
        accept: 'application/json',
        ...(init?.body instanceof FormData ? {} : { 'content-type': 'application/json' }),
        ...(orchestratorSharedSecret ? { [secretHeaderName]: orchestratorSharedSecret } : {}),
        ...init?.headers
      }
    })
  } catch (error) {
    throw new OrchestratorRequestError(
      `Orchestrator request failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      502
    )
  }

  if (!response.ok) {
    const error: unknown = await response.json().catch(() => ({ message: response.statusText }))
    throw new OrchestratorRequestError(getErrorMessage(error, response.statusText), response.status)
  }

  return response.json() as Promise<T>
}
