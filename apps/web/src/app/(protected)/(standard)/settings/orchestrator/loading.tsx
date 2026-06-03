import { SettingsPageSkeleton } from '@/features/settings/components/settings-page-skeleton'

export default function Loading() {
  return (
    <SettingsPageSkeleton
      title='Settings'
      sectionTitle='Runtime'
      rows={4}
      variant='orchestrator'
    />
  )
}
