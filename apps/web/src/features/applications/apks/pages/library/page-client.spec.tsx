import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApkLibraryPageClient } from './page-client'
import type { ApkLibraryData, ApkLibraryEntry } from '@/shared/contracts/apk-library'

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(window.location.search)
}))

const entry = (name: string, apps: ApkLibraryEntry['apps']): ApkLibraryEntry => ({
  id: name,
  originalName: 'stockroom.apk',
  displayName: name,
  sha256: name,
  packageName: 'com.example.stockroom',
  sizeBytes: 100,
  ownerUserIds: [],
  uploads: 1,
  apps,
  googlePlayServices: null,
  inspectionEvidence: [],
  rules: []
})

afterEach(() => window.history.replaceState(null, '', '/'))

describe('APK library app links', () => {
  it('opens the APK referenced by the app and clears only the app link when closed', () => {
    const id = '6d8b5e09-e4bf-4568-9aa9-0572237c04d3'
    window.history.replaceState(null, '', `/platform/apks?status=ready&app=${id}`)
    const data: ApkLibraryData = {
      entries: [entry('Stockroom beta', []), entry('Stockroom', [{ id, name: 'Warehouse QA' }])],
      canDelete: false,
      canBlock: false
    }
    render(<ApkLibraryPageClient initialData={data} />)
    const inspector = screen.getByRole('dialog', { name: /^Stockroom$/ })
    expect(within(inspector).getByText('Warehouse QA')).toBeVisible()
    fireEvent.click(within(inspector).getByRole('button', { name: 'Close' }))
    expect(window.location.search).toBe('?status=ready')
  })
})
