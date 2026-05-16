import { SettingsPageSkeleton } from '../../../_components/settings/settings-page-skeleton'

export default function Loading() {
  return (
    <SettingsPageSkeleton
      title='Orchestrator'
      sectionTitle='Runtime'
      rows={5}
    />
  )
}
