import { runRouteHandler } from '@/server/http/route-handler'
import { readDockerMetrics } from '@/server/platform/docker-diagnostics'

export const GET = () => runRouteHandler(readDockerMetrics)
