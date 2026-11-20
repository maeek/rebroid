import { runRouteHandler } from '@/server/http/route-handler'
import { readOwnedApks } from '@/server/orchestrator/applications/apk-library'

export const GET = (request: Request) =>
  runRouteHandler(() => readOwnedApks(new URL(request.url).searchParams.get('id')))
