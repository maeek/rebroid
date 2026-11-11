'use client'

import { useState, type ReactNode } from 'react'
import { IconGauge, IconInfoCircle, IconShieldCheck, IconUser, IconUsers } from '@tabler/icons-react'
import { Section } from '@/components/ui/section'
import { TabsRoot, TabsList, TabsTrigger, TabsPanel } from '@/components/ui/tabs'

export const AccessEditorLayout = ({
  identity,
  access,
  permissions,
  quotas,
  quotasDescription = 'Resource limits for applications and sessions. Changes apply when you save.',
  loading = false
}: {
  identity: ReactNode
  access?: ReactNode
  permissions: ReactNode
  quotas: ReactNode
  quotasDescription?: string
  loading?: boolean
}) => {
  const [tab, setTab] = useState('account')
  const IdentityIcon = access ? IconUser : IconInfoCircle
  return (
    <TabsRoot
      value={tab}
      onValueChange={setTab}
      className='grid min-w-0 gap-6'
    >
      <TabsList
        ariaLabel={access ? 'User settings' : 'Group settings'}
        variant='resource'
      >
        <TabsTrigger
          value='account'
          icon={<IdentityIcon className='size-3.5' />}
        >
          {access ? 'Account' : 'Details'}
        </TabsTrigger>
        {access ? (
          <TabsTrigger
            value='groups'
            icon={<IconUsers className='size-3.5' />}
          >
            Groups
          </TabsTrigger>
        ) : null}
        <TabsTrigger
          value='permissions'
          icon={<IconShieldCheck className='size-3.5' />}
        >
          Permissions
        </TabsTrigger>
        <TabsTrigger
          value='quotas'
          icon={<IconGauge className='size-3.5' />}
        >
          Quotas
        </TabsTrigger>
      </TabsList>
      <TabsPanel value='account'>
        <div className='grid min-w-0 gap-6'>{identity}</div>
      </TabsPanel>
      {access ? (
        <TabsPanel value='groups'>
          <Section
            title='Group membership'
            description='Later groups take precedence when permissions or quotas conflict. The Administrators group always grants full access.'
            surface='plain'
          >
            {access}
          </Section>
        </TabsPanel>
      ) : null}
      <TabsPanel value='permissions'>
        <Section
          aria-label='Permissions'
          description={
            access
              ? 'Review effective access and its source. Use an override only when this user needs an exception.'
              : 'Grant or deny permissions for members. Not set leaves a permission to other groups; later groups take precedence.'
          }
          surface='plain'
        >
          {permissions}
        </Section>
      </TabsPanel>
      <TabsPanel value='quotas'>
        <Section
          aria-label='Quotas'
          description={quotasDescription}
          surface='plain'
        >
          {quotas}
        </Section>
      </TabsPanel>
      {loading ? (
        <span
          className='sr-only'
          role='status'
        >
          Loading settings
        </span>
      ) : null}
    </TabsRoot>
  )
}
