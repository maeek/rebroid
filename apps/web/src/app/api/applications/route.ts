import { NextResponse } from 'next/server'
import { listApplicationsAction } from '@/server/orchestrator/applications/actions/queries/listing-actions'

export const dynamic = 'force-dynamic'

export const GET = async () => NextResponse.json(await listApplicationsAction())
