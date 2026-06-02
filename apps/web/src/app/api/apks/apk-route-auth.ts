import { NextResponse } from 'next/server'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'
import { hasPermission } from '@/shared/permissions/permissions'

export type ApkRouteUser = Awaited<ReturnType<typeof getCurrentUserContext>>

export const getApkRouteUser = async (): Promise<
  { user: ApkRouteUser; response: null } | { user: null; response: NextResponse }
> => {
  let user: ApkRouteUser
  try {
    user = await getCurrentUserContext()
  } catch {
    return { user: null, response: NextResponse.json({ message: 'Authentication required' }, { status: 401 }) }
  }

  if (user.role !== 'admin' && !hasPermission(user.permissions, 'applications:upload-apk')) {
    return {
      user: null,
      response: NextResponse.json({ message: 'APK upload permission is required' }, { status: 403 })
    }
  }

  return { user, response: null }
}
