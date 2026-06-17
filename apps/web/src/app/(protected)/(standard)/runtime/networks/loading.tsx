import { PlatformInventoryPageSkeleton } from '@/features/platform/components/loaders/platform-page-skeletons'

export default function Loading() {
  return (
    <PlatformInventoryPageSkeleton
      titleWidth='w-40 max-sm:w-[7.5rem]'
      minWidth='78rem'
      columns={[
        { width: '22rem', headerWidth: 'w-20', kind: 'stacked' },
        { width: '8rem', headerWidth: 'w-16', kind: 'text', cellWidth: 'w-20' },
        { width: '7rem', headerWidth: 'w-14', kind: 'text', cellWidth: 'w-14' },
        { width: '20rem', headerWidth: 'w-14', kind: 'text', cellWidth: 'w-[76%]' },
        { width: '12rem', headerWidth: 'w-16', kind: 'text', cellWidth: 'w-[72%]' },
        { width: '8rem', headerWidth: 'w-[4.5rem]', kind: 'text', cellWidth: 'w-12' },
        { width: '10rem', headerWidth: 'w-16', kind: 'actions' }
      ]}
    />
  )
}
