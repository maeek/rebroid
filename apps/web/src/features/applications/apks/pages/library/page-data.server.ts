import { redirect } from 'next/navigation'
import 'server-only'
import { loadApkLibrary } from '@/server/orchestrator/applications/apk-library'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'
import { hasPermission } from '@/shared/permissions/permissions'

export const authorizeApkLibraryPage = async () => {
  const { permissions } = await getCurrentUserContext()
  if (!hasPermission(permissions, 'apks:review')) redirect('/apps')
  return permissions
}

export const loadApkLibraryPage = loadApkLibrary
