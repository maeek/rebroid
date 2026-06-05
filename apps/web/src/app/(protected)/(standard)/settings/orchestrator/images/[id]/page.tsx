import { redirect } from 'next/navigation'

export default async function ImageRedirectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  redirect(`/infrastructure/images/${encodeURIComponent(id)}`)
}
