'use client'

import { EditorPage } from '@/shared/ui/page/editor-page'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent } from '@/shared/ui/page/page-layout'
import { AccountMfaSettings } from '../../ui/account-mfa-settings'
import { AccountPasswordSettings } from '../../ui/account-password-settings'
import { AccountSessionsSection } from '../../ui/account-sessions-section'
import type { AccountSession } from '@/shared/contracts/account-session'

export const PreferencesSecurityPageClient = ({
  mfaEnabled,
  sessions,
  loading = false
}: {
  mfaEnabled: boolean
  sessions?: AccountSession[]
  loading?: boolean
}) => (
  <EditorPage className='gap-2'>
    <PageHeader
      section={{ label: 'Preferences' }}
      title='Security'
      description='Manage your password, multi-factor authentication, and active sessions.'
    />
    <PageContent>
      <div className='grid min-w-0 gap-x-form-column gap-y-6 lg:grid-cols-2'>
        <AccountPasswordSettings loading={loading} />
        <AccountMfaSettings
          initialEnabled={mfaEnabled}
          loading={loading}
        />
      </div>
      <AccountSessionsSection
        sessions={sessions}
        loading={loading}
      />
    </PageContent>
  </EditorPage>
)
