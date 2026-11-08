import { runRouteHandler } from '@/server/http/route-handler'
import { readDockerOperationLimits, saveDockerOperationLimits } from '@/server/platform/docker-operation-settings'

export const GET = () => runRouteHandler(readDockerOperationLimits)
export const PATCH = (request: Request) => runRouteHandler(async () => saveDockerOperationLimits(await request.json()))
