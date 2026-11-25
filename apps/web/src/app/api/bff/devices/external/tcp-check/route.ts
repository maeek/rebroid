import { runRouteHandler } from '@/server/http/route-handler'
import { checkExternalTcpEndpoint } from '@/server/orchestrator/external-devices/operations'

export const POST = (request: Request) =>
  runRouteHandler(async () => checkExternalTcpEndpoint(await request.json().catch(() => null)))
