import { runRouteHandler } from '@/server/http/route-handler'
import { getSystemResources } from '@/server/platform/queries'

export const GET = () => runRouteHandler(getSystemResources)
