import { SettingsPageSkeleton } from '@/features/settings/components/settings-page-skeleton'

export default function Loading() {
  return (
    <SettingsPageSkeleton
      title='Users'
      sectionTitle='Existing users'
      rows={4}
    />
  )
}
