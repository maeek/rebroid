import { runRouteHandler } from '@/server/http/route-handler'
import { operateExternalDevice } from '@/server/orchestrator/external-devices/operations'

export const POST = (request: Request, { params }: { params: Promise<{ id: string }> }) =>
  runRouteHandler(async () => operateExternalDevice((await params).id, await request.json().catch(() => null)))
