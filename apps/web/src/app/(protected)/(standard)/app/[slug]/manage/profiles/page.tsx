import { redirect } from 'next/navigation'
import { appResourceHref } from '@/features/applications/detail/app-resource-links'

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  redirect(appResourceHref(slug, 'profiles'))
}
