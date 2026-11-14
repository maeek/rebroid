import type { ReactNode } from 'react'
import { AppLoadingDisplayContext } from '@/features/applications/detail/app-loading-display-context'
import { getApplicationLoadingDisplaySize } from '../shared/application-page-data.server'

export const ApplicationViewerRouteLayout = async ({
  children,
  params
}: {
  children: ReactNode
  params: Promise<{ slug: string }>
}) => {
  const { slug } = await params
  return <AppLoadingDisplayContext value={getApplicationLoadingDisplaySize(slug)}>{children}</AppLoadingDisplayContext>
}
