import { yourApps } from '../../constants'
import { AppViewerPage } from './app-page'

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const app = yourApps.find(a => a.id === slug)

  return <AppViewerPage app={app} />
}
