export const runtimeInventoryPageHeaders = {
  containers: {
    title: 'Containers',
    description: 'Docker containers visible to the platform. Managed application containers are shown first.'
  },
  networks: {
    title: 'Networks',
    description: 'Docker networks visible to the platform, including application isolation networks.'
  },
  images: {
    title: 'Images',
    description: 'Local images available to application containers, custom runtimes, and platform sidecars.'
  }
} as const
