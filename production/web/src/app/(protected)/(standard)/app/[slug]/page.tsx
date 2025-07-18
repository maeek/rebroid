import { yourApps } from '../../constants'
import { ViewerPage } from './viewer'

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const app = yourApps.find(app => app.id === slug)

  return <ViewerPage app={app} />
}
