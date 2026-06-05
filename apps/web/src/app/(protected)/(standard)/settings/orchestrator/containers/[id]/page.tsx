import { redirect } from 'next/navigation'

export default async function ContainerRedirectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  redirect(`/infrastructure/containers/${encodeURIComponent(id)}`)
}
