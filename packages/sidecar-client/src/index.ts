import createClient from 'openapi-fetch'
import type { components, paths } from './schema'

export type SidecarApiPaths = paths
export type SidecarApiSchemas = components["schemas"]

export const createSidecarClient = (baseUrl: string, sharedSecret: string) =>
  createClient<paths>({
    baseUrl,
    headers: { 'x-rebroid-sidecar-secret': sharedSecret }
  })
