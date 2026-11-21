import { getStoredAppIcon } from '@/server/app-icons/store'

export const withStoredAppIcon = async <T extends { id: string; icon: string | null }>(app: T): Promise<T> => ({
  ...app,
  icon: (await getStoredAppIcon(app.id)) ?? app.icon
})

export const withStoredAppIcons = async <T extends { id: string; icon: string | null }>(apps: T[]) =>
  Promise.all(apps.map(withStoredAppIcon))
