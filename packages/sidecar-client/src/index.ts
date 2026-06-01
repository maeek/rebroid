import createClient from 'openapi-fetch'
import type { paths } from './schema'

export type SidecarApiPaths = paths

export const createSidecarClient = (baseUrl: string, sharedSecret: string) =>
  createClient<paths>({
    baseUrl,
    headers: { 'x-rebroid-sidecar-secret': sharedSecret }
  })
