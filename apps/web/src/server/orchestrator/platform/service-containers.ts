import { hostname } from 'node:os'
import 'server-only'
import { requireAdmin } from '@/server/auth/authorization'
import { getOrchestratorBaseUrl } from '@/server/orchestrator/config'
import { readOrchestratorPage } from '@/server/orchestrator/orchestrator-page-read'
import { orchestratorPlatformClient } from './client'
import type { OrchestratorHealth, ServiceContainerIds, ServiceHealth } from '@/shared/contracts/diagnostics'
import type { PlatformContainer } from '@/shared/contracts/platform'
import type { OptionalServicesUiSettings } from '@/shared/model/settings/orchestrator-ui-settings'

const composeProjectLabel = 'com.docker.compose.project'
const composeServiceLabel = 'com.docker.compose.service'

const findUnique = (containers: PlatformContainer[], matches: (container: PlatformContainer) => boolean) => {
  const candidates = containers.filter(matches)
  return candidates.length === 1 ? candidates[0] : undefined
}

const endpointHost = (endpoint?: string | null) => {
  if (!endpoint) return undefined
  const url = URL.parse(endpoint)
  if (!url || !['http:', 'https:'].includes(url.protocol) || url.hostname === 'localhost') return undefined
  return /^[a-z0-9][a-z0-9_-]*$/i.test(url.hostname) ? url.hostname : undefined
}

export const resolveServiceContainerIds = (
  containers: PlatformContainer[],
  {
    webHostname,
    orchestratorEndpoint,
    displayEndpoint,
    displayHealth,
    settings
  }: {
    webHostname: string
    orchestratorEndpoint: string
    displayEndpoint?: string
    displayHealth?: ServiceHealth
    settings?: Partial<OptionalServicesUiSettings>
  }
): ServiceContainerIds => {
  const named = (name: string) => findUnique(containers, container => container.names.includes(name))
  const identified = (id: string) =>
    findUnique(containers, container => container.id === id || container.shortId === id)
  const web = identified(webHostname) ?? named(webHostname)
  const webProject = web?.labels[composeServiceLabel] === 'web' ? web.labels[composeProjectLabel] : undefined
  const composeContainer = (project: string | undefined, service: string) =>
    project
      ? findUnique(
          containers,
          container =>
            container.labels[composeProjectLabel] === project && container.labels[composeServiceLabel] === service
        )
      : undefined
  const endpointContainer = (endpoint: string | null | undefined, project: string | undefined, service: string) => {
    const host = endpointHost(endpoint)
    if (!host) return undefined
    if (host === service && project) return composeContainer(project, service)
    return named(host)
  }

  const orchestrator = endpointContainer(orchestratorEndpoint, webProject, 'orchestrator')
  const project = orchestrator?.labels[composeProjectLabel]
  const displayDetails = displayHealth?.details
  let display = endpointContainer(displayEndpoint, project, 'display-sidecar')
  if (typeof displayDetails?.containerId === 'string') {
    display = identified(displayDetails.containerId)
  } else if (typeof displayDetails?.containerName === 'string') {
    display = named(displayDetails.containerName)
  }
  const firewallEndpoint = settings?.firewall?.endpoint
  const firewall =
    firewallEndpoint === '/run/rebroid-firewall/agent.sock'
      ? composeContainer(project, 'firewall-agent')
      : endpointContainer(firewallEndpoint, project, 'firewall-agent')

  return {
    orchestrator: orchestrator?.id,
    display: display?.id,
    firewall: firewall?.id,
    ocr: endpointContainer(settings?.ocr?.endpoint, project, 'ocr-sidecar')?.id
  }
}

const loadConnectionContainers = async (health: OrchestratorHealth | null) => {
  if (!health?.services.docker?.ok) return []
  await requireAdmin()

  // These links are optional, so Docker inventory should not delay service diagnostics for long.
  const result = await readOrchestratorPage(
    () => orchestratorPlatformClient.listPlatformContainers(AbortSignal.timeout(2_000)),
    { allowMissing: true }
  )
  return result.ok && Array.isArray(result.data) ? result.data : []
}

export const loadServiceContainerIds = async (
  health: OrchestratorHealth | null,
  {
    displayHealth = health?.services.display,
    settings
  }: { displayHealth?: ServiceHealth; settings?: Partial<OptionalServicesUiSettings> } = {}
): Promise<ServiceContainerIds> => {
  const containers = await loadConnectionContainers(health)
  if (!containers.length) return {}

  return resolveServiceContainerIds(containers, {
    webHostname: hostname(),
    orchestratorEndpoint: getOrchestratorBaseUrl(),
    displayEndpoint: process.env.DISPLAY_SIDECAR_INTERNAL_BASE_URL ?? 'http://rebroid-display-sidecar:8000',
    displayHealth,
    settings
  })
}

export const loadEndpointContainerId = async (health: OrchestratorHealth, endpoint: string) => {
  const host = endpointHost(endpoint)
  if (!host) return undefined

  const containers = await loadConnectionContainers(health)
  return findUnique(containers, container => container.names.includes(host))?.id
}
