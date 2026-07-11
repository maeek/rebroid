import { runRouteHandler } from '@/server/http/route-handler'
import { getResourceLimitBounds } from '@/server/platform/queries'

export const GET = () => runRouteHandler(getResourceLimitBounds)
