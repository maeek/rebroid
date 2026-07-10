import { CreateAppPageEntry } from '@/features/applications/pages/create-app/page-entry'

export default async function CreateAppPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = (await searchParams) ?? {}
  const image = Array.isArray(params.image) ? params.image[0] : params.image
  const apk = Array.isArray(params.apk) ? params.apk[0] : params.apk
  return (
    <CreateAppPageEntry
      initialImage={image}
      uploadedApkId={apk}
    />
  )
}
