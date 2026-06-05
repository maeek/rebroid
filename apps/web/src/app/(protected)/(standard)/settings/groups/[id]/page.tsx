import { redirect } from 'next/navigation'

export default async function GroupRedirectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  redirect(`/users/groups/${encodeURIComponent(id)}`)
}
