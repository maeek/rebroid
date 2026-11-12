'use client'

import { EditorPage } from '@/shared/ui/page/editor-page'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent } from '@/shared/ui/page/page-layout'
import { AccountMfaSettings } from '../../ui/account-mfa-settings'
import { AccountPasswordSettings } from '../../ui/account-password-settings'

export const PreferencesSecurityPageClient = ({
  mfaEnabled,
  loading = false
}: {
  mfaEnabled: boolean
  loading?: boolean
}) => (
  <EditorPage className='gap-2'>
    <PageHeader
      section={{ label: 'Preferences' }}
      title='Security'
      description='Manage your password and multi-factor authentication.'
    />
    <PageContent>
      <div className='grid min-w-0 items-start gap-x-form-column gap-y-6 lg:grid-cols-2'>
        <AccountMfaSettings
          initialEnabled={mfaEnabled}
          loading={loading}
        />
        <AccountPasswordSettings loading={loading} />
      </div>
    </PageContent>
  </EditorPage>
)
