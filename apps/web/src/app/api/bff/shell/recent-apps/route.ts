import { runRouteHandler } from '@/server/http/route-handler'
import { listVisibleRecentApps } from '@/server/recent-apps/service'

export const GET = () => runRouteHandler(listVisibleRecentApps)
