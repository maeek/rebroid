import { PlatformInventoryPageSkeleton } from '@/features/platform/components/loaders/platform-page-skeletons'

export default function Loading() {
  return (
    <PlatformInventoryPageSkeleton
      titleWidth='w-36 max-sm:w-28'
      minWidth='72rem'
      columns={[
        { width: '24rem', headerWidth: 'w-16', kind: 'stacked' },
        { width: '9rem', headerWidth: 'w-14', kind: 'text', cellWidth: 'w-20' },
        { width: '9rem', headerWidth: 'w-16', kind: 'text', cellWidth: 'w-24' },
        { width: '8rem', headerWidth: 'w-[4.5rem]', kind: 'text', cellWidth: 'w-12' },
        { width: '14rem', headerWidth: 'w-10', kind: 'text', cellWidth: 'w-28' },
        { width: '10rem', headerWidth: 'w-16', kind: 'actions' }
      ]}
    />
  )
}
