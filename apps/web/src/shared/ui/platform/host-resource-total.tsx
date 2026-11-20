import { formatDisplayNumber } from '@/lib/format'
import type { SystemResourceCapacity } from '@/shared/contracts/system-resources'

const gibibyte = 1024 ** 3
const mebibyte = 1024 ** 2

const formatRam = (bytes: number) => {
  const inGiB = bytes >= gibibyte
  const amount = Number((bytes / (inGiB ? gibibyte : mebibyte)).toFixed(2))
  return `${formatDisplayNumber(amount)} ${inGiB ? 'GiB' : 'MiB'}`
}

export const HostResourceTotal = ({
  resource,
  capacity
}: {
  resource: 'ram' | 'cpu'
  capacity?: SystemResourceCapacity | null
}) => {
  const total = resource === 'ram' ? capacity?.hostMemoryBytes : capacity?.hostCpuCores
  if (typeof total !== 'number' || !Number.isFinite(total) || total <= 0) return 'Host total unavailable'

  const value =
    resource === 'ram' ? formatRam(total) : `${formatDisplayNumber(total)} logical ${total === 1 ? 'CPU' : 'CPUs'}`

  return (
    <>
      Host total <span className='font-medium tabular-nums text-foreground'>{value}</span>
    </>
  )
}
