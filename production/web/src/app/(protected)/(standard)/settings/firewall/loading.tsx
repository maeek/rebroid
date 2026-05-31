import { OperationalSettingsPageSkeleton } from '@/features/settings/orchestrator/operational-settings-skeleton'

export default function Loading() {
  return (
    <OperationalSettingsPageSkeleton
      titleWidth='w-36 max-sm:w-24'
      sectionTitle='Firewall agent'
      minWidth='58rem'
      columns={[
        { width: '14rem', headerWidth: 'w-20', kind: 'text' },
        { width: '8rem', headerWidth: 'w-14', kind: 'text' },
        { width: '10rem', headerWidth: 'w-14', kind: 'badge' },
        { width: '8rem', headerWidth: 'w-14', kind: 'text' },
        { width: '10rem', headerWidth: 'w-14', kind: 'badge' },
        { width: '10rem', headerWidth: 'w-14', kind: 'actions' }
      ]}
    />
  )
}
