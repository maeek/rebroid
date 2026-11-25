import { redirect } from 'next/navigation'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'
import { hasPermission } from '@/shared/permissions/permissions'
import { renderExternalDevicesPage } from '../external-devices/page-entry'

export async function RegisterDevicePageEntry() {
  const user = await getCurrentUserContext()
  if (!hasPermission(user.permissions, 'devices:enroll-external')) redirect('/devices')

  return renderExternalDevicesPage(true)
}
