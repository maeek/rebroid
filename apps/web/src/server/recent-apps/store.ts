import { listRecentApplications, rememberRecentApplication } from '@/server/persistence/recent-applications-repository'

export const listStoredRecentApps = (userId: string) => listRecentApplications(userId)

export const rememberStoredRecentApp = (userId: string, appId: string) => rememberRecentApplication(userId, appId)
