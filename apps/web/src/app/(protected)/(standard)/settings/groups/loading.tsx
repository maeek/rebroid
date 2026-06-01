import { SettingsPageSkeleton } from '@/features/settings/components/settings-page-skeleton'

export default function Loading() {
  return (
    <SettingsPageSkeleton
      title='Groups'
      sectionTitle='Existing groups'
      rows={3}
    />
  )
}
