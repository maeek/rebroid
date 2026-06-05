import { redirect } from 'next/navigation'

export default async function NetworkRedirectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  redirect(`/infrastructure/networks/${encodeURIComponent(id)}`)
}
