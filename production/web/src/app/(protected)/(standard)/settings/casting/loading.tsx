import { OperationalSettingsPageSkeleton } from '@/features/settings/orchestrator/operational-settings-skeleton'

export default function Loading() {
  return (
    <OperationalSettingsPageSkeleton
      titleWidth='w-36 max-sm:w-24'
      sectionTitle='Display sidecar'
      minWidth='52rem'
      columns={[
        { width: '12rem', headerWidth: 'w-20', kind: 'text' },
        { width: '12rem', headerWidth: 'w-14', kind: 'text' },
        { width: '8rem', headerWidth: 'w-14', kind: 'badge' },
        { width: '14rem', headerWidth: 'w-24', kind: 'text' },
        { width: '14rem', headerWidth: 'w-14', kind: 'text' },
        { width: '9rem', headerWidth: 'w-14', kind: 'actions' }
      ]}
    />
  )
}
