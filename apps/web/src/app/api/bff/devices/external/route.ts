import { runRouteHandler } from '@/server/http/route-handler'
import { loadExternalDeviceInventory, registerExternalDevice } from '@/server/orchestrator/external-devices/operations'

export const GET = () => runRouteHandler(() => loadExternalDeviceInventory('api'))
export const POST = (request: Request) =>
  runRouteHandler(async () => registerExternalDevice(await request.json().catch(() => null)))
