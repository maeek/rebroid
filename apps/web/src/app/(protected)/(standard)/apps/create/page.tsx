import { CreateAppPageEntry } from '@/features/applications/pages/create-app/page-entry'

export default async function CreateAppPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = (await searchParams) ?? {}
  const image = Array.isArray(params.image) ? params.image[0] : params.image
  return <CreateAppPageEntry initialImage={image} />
}
