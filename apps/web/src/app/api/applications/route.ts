import { NextResponse } from 'next/server'
import { listApplicationsAction } from '@/server/orchestrator/applications/read-actions'

export const dynamic = 'force-dynamic'

export const GET = async () => NextResponse.json(await listApplicationsAction())
