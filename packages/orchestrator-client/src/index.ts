import createClient from 'openapi-fetch'
import type { components, paths } from './schema'

export type OrchestratorApiPaths = paths
export type OrchestratorApiSchemas = components['schemas']

export const createOrchestratorClient = (baseUrl: string, sharedSecret: string) =>
  createClient<paths>({
    baseUrl,
    headers: { 'x-orchestrator-secret': sharedSecret }
  })
