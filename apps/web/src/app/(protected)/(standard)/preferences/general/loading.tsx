import { SettingsPageSkeleton } from '@/shared/ui/settings/settings-page-skeleton'

export default function Loading() {
  return (
    <SettingsPageSkeleton
      title='General'
      sectionTitle='Misc'
      rows={2}
    />
  )
}
