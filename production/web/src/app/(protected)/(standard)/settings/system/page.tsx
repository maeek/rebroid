'use client'
import { trpc } from '@/app/_trpc/client'
import { SystemChart } from './_components/chart'
import { DetailsTable } from './_components/details-table'
import { MemoryChart } from './_components/memory-chart'

export default function SystemPage() {
  const { data: systemUtilization, isLoading } = trpc.system.getSystemStats.useQuery(undefined, {
    refetchInterval: 5000,
    refetchOnReconnect: true
  })

  return isLoading ? (
    <div>Loading...</div>
  ) : (
    <div className='pl-72 max-lg:pl-0 min-h-full'>
      <main className='row-layout flex-col max-w-100dvh'>
        <section className='py-4 px-4 flex items-center justify-between gap-3 flex-shrink-0'>
          <h2 className='text-3xl max-sm:text-xl font-medium flex-shrink-0'>System</h2>
        </section>
        <section className='px-4 w-full flex flex-col gap-4 flex-shrink flex-wrap pb-16'>
          <div className='flex gap-4 items-stretch flex-wrap w-full'>
            <div className='bg-card/60 bg-opacity-40 rounded-xl gap-4 hover:bg-card/50 border border-input h-auto flex-auto p-2'>
              <DetailsTable systemUtilization={systemUtilization} />
            </div>
            <div className='bg-card/60 bg-opacity-40 rounded-xl gap-4 hover:bg-card/50 border border-input h-auto flex-auto min-w-10'>
              <MemoryChart
                totalMemory={systemUtilization?.totalMemoryBytes ?? 0}
                freeMemory={systemUtilization?.freeMemoryBytes ?? 0}
              />
            </div>
          </div>
          <div className='bg-card/60 bg-opacity-40 rounded-xl gap-4 hover:bg-card/50 border border-input flex-auto h-[40rem] w-full max-lg:h-96'>
            <SystemChart cpuData={systemUtilization?.cpuUsagePercentLast50Entrires} />
          </div>
        </section>
      </main>
    </div>
  )
}
