import 'server-only'

const defaultOrchestratorUrl = 'http://localhost:4100'
const allowedOrchestratorProtocols = new Set(['http:', 'https:'])

export const getOrchestratorBaseUrl = () => {
  const rawUrl = process.env.ORCHESTRATOR_API_URL?.trim() || defaultOrchestratorUrl
  const url = new URL(rawUrl)

  if (!allowedOrchestratorProtocols.has(url.protocol)) {
    throw new Error('ORCHESTRATOR_API_URL must use http or https.')
  }

  url.pathname = url.pathname.replace(/\/+$/, '')
  url.search = ''
  url.hash = ''

  return url.toString().replace(/\/$/, '')
}

export const getOrchestratorApiUrl = (path: string) => {
  if (!path.startsWith('/') || path.startsWith('//')) {
    throw new Error('Orchestrator API paths must start with a single slash.')
  }

  const base = new URL(`${getOrchestratorBaseUrl()}/api/v1/`)
  const url = new URL(path.slice(1), base)

  if (!url.pathname.startsWith(base.pathname)) {
    throw new Error('Orchestrator API paths cannot escape the API root.')
  }

  return url.toString()
}
