import { AppDefinition } from '@/app/(protected)/(standard)/constants'
import { getStoredAppIcon } from '@/server/app-icons/store'

export const withStoredAppIcon = async (app: AppDefinition): Promise<AppDefinition> => ({
  ...app,
  icon: (await getStoredAppIcon(app.id)) ?? app.icon
})

export const withStoredAppIcons = async (apps: AppDefinition[]) => Promise.all(apps.map(withStoredAppIcon))
