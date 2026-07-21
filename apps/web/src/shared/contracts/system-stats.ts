export interface SystemNetworkInterface {
  address: string
  netmask: string
  family: string
  mac: string
  internal: boolean
  cidr: string | null
  scopeid?: number
}

export interface SystemStats {
  platform: string
  architecture: string
  cpu: string
  cpuCores: number
  cpuUsage: string
  totalMemory: string
  totalMemoryBytes: number
  freeMemory: string
  freeMemoryBytes: number
  memoryUsage: string
  uptime: string
  networkInterfaces: Record<string, SystemNetworkInterface[] | undefined>
  homeDirectory: string
  hostname: string
  cpuUsagePercentLast50Entrires: [string, number][]
}
