import { SettingsPageSkeleton } from '../../../_components/settings/settings-page-skeleton'

export default function Loading() {
  return (
    <SettingsPageSkeleton
      title='General'
      sectionTitle='Misc'
      rows={2}
    />
  )
}
