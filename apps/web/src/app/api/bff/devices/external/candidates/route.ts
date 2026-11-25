import { runRouteHandler } from '@/server/http/route-handler'
import { listExternalUsbCandidates } from '@/server/orchestrator/external-devices/operations'

export const GET = () => runRouteHandler(listExternalUsbCandidates)
