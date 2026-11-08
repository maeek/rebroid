import { DetailFields } from '@/shared/ui/detail-fields'

export const DetailRowsSkeleton = ({ rows = 5 }: { rows?: number }) => (
  <DetailFields
    loading
    fields={Array.from({ length: rows }, (_, index) => ({ label: `Field ${index}`, value: null }))}
  />
)
