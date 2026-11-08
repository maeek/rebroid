import { runRouteHandler } from '@/server/http/route-handler'
import { getPlatformOperations } from '@/server/platform/operations-query'
export const GET = () => runRouteHandler(getPlatformOperations)
