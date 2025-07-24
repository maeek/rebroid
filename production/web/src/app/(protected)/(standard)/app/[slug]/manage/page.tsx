import { yourApps } from '../../../constants'
import AppManage from './app-manage'

export default async function ManagePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const app = yourApps.find(a => a.id === slug)
  return <AppManage app={app} />
}
