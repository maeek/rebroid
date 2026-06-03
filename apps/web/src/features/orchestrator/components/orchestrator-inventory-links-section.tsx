import { IconBox, IconBrandDocker, IconNetwork } from '@tabler/icons-react'
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
  }
]

export const OrchestratorInventoryLinksSection = () => (
  <Section
    title='Inventory'
    boxed
    titleClassName='pb-4'
  >
    <div className='grid gap-4 lg:grid-cols-3'>
      {inventoryLinks.map(({ title, description, href, Icon }) => (
        <Link
          key={href}
          href={href}
          className='rounded-md border border-border/70 bg-secondary/30 p-4 transition hover:border-primary/50 hover:bg-secondary/50'
        >
          <div className='mb-4 flex size-10 items-center justify-center rounded-md bg-muted text-secondary-foreground'>
            <Icon className='size-5' />
          </div>
          <h3 className='font-medium text-foreground'>{title}</h3>
          <p className='mt-1 text-sm leading-5 text-secondary-foreground'>{description}</p>
        </Link>
      ))}
    </div>
  </Section>
)
