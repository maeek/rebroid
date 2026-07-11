import { notFound } from 'next/navigation'
import { SkeletonContractFixture } from '@/features/platform/components/skeleton-contract-fixture'

export const dynamic = 'force-dynamic'

export default function SkeletonContractPage() {
  if (process.env.ENABLE_SKELETON_CONTRACT_ROUTE !== '1') notFound()

  return <SkeletonContractFixture />
}
