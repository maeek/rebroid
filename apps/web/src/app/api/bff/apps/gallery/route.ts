import { runRouteHandler } from '@/server/http/route-handler'
import { listApplicationGallery } from '@/server/orchestrator/applications/application-gallery-query'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'

export const GET = () => runRouteHandler(async () => listApplicationGallery(await getCurrentUserContext()))
