import { runRouteHandler } from '@/server/http/route-handler'
import { loadApkLibrary, mutateApkLibrary } from '@/server/orchestrator/applications/apk-library'

export const GET = () => runRouteHandler(loadApkLibrary)
export const POST = (request: Request) =>
  runRouteHandler(async () => mutateApkLibrary(await request.json().catch(() => null)))
