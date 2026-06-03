import { SettingsPageSkeleton } from '@/features/settings/components/settings-page-skeleton'

export default function Loading() {
  return (
    <SettingsPageSkeleton
      title='Scheduled tasks'
      sectionTitle='Tasks'
      rows={4}
    />
  )
}
