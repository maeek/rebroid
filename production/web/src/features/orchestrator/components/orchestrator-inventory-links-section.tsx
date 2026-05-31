import { IconBox, IconBrandDocker, IconDeviceDesktop, IconNetwork, IconShieldLock } from '@tabler/icons-react'
import Link from 'next/link'
import { Section } from '@/components/ui/section'

const inventoryLinks = [
  {
    title: 'Containers',
    description: 'Inspect managed and platform containers, open details, and review logs.',
    href: '/settings/orchestrator/containers',
    Icon: IconBox
  },
  {
    title: 'Images',
    description: 'Search local images and remove images that are no longer needed.',
    href: '/settings/orchestrator/images',
    Icon: IconBrandDocker
  },
  {
    title: 'Networks',
    description: 'Review platform networks and per-application isolation networks.',
    href: '/settings/orchestrator/networks',
    Icon: IconNetwork
  },
  {
    title: 'Casting',
    description: 'Inspect display-sidecar health and terminate active viewer sessions.',
    href: '/settings/casting',
    Icon: IconDeviceDesktop
  },
  {
    title: 'Firewall',
    description: 'Review and change outbound network restrictions for application containers.',
    href: '/settings/firewall',
    Icon: IconShieldLock
  }
]

export const OrchestratorInventoryLinksSection = () => (
  <Section
    title='Inventory'
    boxed
    titleClassName='pb-4'
    contentClassName='gap-3'
  >
    <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-3'>
      {inventoryLinks.map(({ title, description, href, Icon }) => (
        <Link
          key={href}
          href={href}
          className='group flex min-h-32 flex-col gap-3 rounded-lg border border-border/60 bg-background/35 p-4 transition hover:border-primary/35 hover:bg-primary/5'
        >
          <div className='flex size-10 items-center justify-center rounded-md bg-secondary text-secondary-foreground group-hover:text-primary'>
            <Icon className='size-5' />
          </div>
          <div className='flex flex-col gap-1'>
            <h3 className='font-medium'>{title}</h3>
            <p className='text-sm text-secondary-foreground'>{description}</p>
          </div>
        </Link>
      ))}
    </div>
  </Section>
)
