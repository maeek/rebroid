import { SettingsPageSkeleton } from '@/features/settings/components/settings-page-skeleton'

export default function Loading() {
  return (
    <SettingsPageSkeleton
      title='General'
      sectionTitle='Misc'
      rows={2}
    />
  )
}
