import { runRouteHandler } from '@/server/http/route-handler'
import { listRecentlyOpenedApps } from '@/server/recent-apps/service'

export const GET = () => runRouteHandler(listRecentlyOpenedApps)
