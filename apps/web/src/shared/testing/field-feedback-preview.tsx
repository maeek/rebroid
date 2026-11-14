'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { FileDropZone } from '@/components/ui/file-drop-zone'
import { FileUploadField } from '@/components/ui/file-upload-field'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Section } from '@/components/ui/section'
import { TooltipProvider } from '@/components/ui/tooltip'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'

export const FieldFeedbackPreview = () => {
  const [name, setName] = useState('Example app')
  const [savedName, setSavedName] = useState(name)
  const [error, setError] = useState<string>()
  const [filename, setFilename] = useState('No file selected')
  const [pending, setPending] = useState(false)
  const [disabled, setDisabled] = useState(false)
  const select = (file?: File) => {
    if (file) {
      setFilename(file.name)
      setPending(true)
    }
  }
  return (
    <TooltipProvider>
      <StandardPage>
        <PageHeader title='File and field feedback' />
        <PageContent>
          <Section
            contentClassName='gap-5'
            title='Application settings'
            surface='panel'
          >
            <FormField
              label='Name'
              description='Display name for this app.'
              modified={name !== savedName}
              error={error}
              layout='vertical'
            >
              <Input
                value={name}
                onChange={event => {
                  setName(event.target.value)
                  setError(undefined)
                }}
              />
            </FormField>
            <FormField
              label='Description'
              layout='vertical'
            >
              <Input defaultValue='Unchanged field' />
            </FormField>
            <div className='flex flex-wrap gap-2'>
              <Button
                onClick={() => {
                  setSavedName(name)
                  setError(undefined)
                }}
              >
                Save changes
              </Button>
              <Button
                variant='secondary'
                onClick={() => {
                  setName(savedName)
                  setError(undefined)
                }}
              >
                Discard changes
              </Button>
              <Button
                variant='secondary'
                onClick={() =>
                  setError(
                    'This name is already used. Choose a different name so your teammates can distinguish this app from the existing application. Your other changes are kept.'
                  )
                }
              >
                Validate name
              </Button>
            </div>
          </Section>
          <Section
            title='Upload files'
            surface='panel'
          >
            <FileDropZone
              onFiles={files => select(files[0])}
              disabled={disabled || pending}
              description='Destination: Downloads'
              className='grid min-h-32 content-center gap-4'
            >
              <FormField
                label='APK'
                layout='vertical'
              >
                <FileUploadField
                  accept='.apk'
                  pending={pending}
                  disabled={disabled}
                  filenameLabel={filename}
                  onChange={event => select(event.target.files?.[0])}
                />
              </FormField>
            </FileDropZone>
            <div className='flex items-center gap-3'>
              <Button
                variant='secondary'
                onClick={() => setPending(false)}
              >
                Finish upload
              </Button>
              <label className='flex items-center gap-2'>
                <Checkbox
                  checked={disabled}
                  onCheckedChange={setDisabled}
                />{' '}
                Disable uploads
              </label>
            </div>
          </Section>
        </PageContent>
      </StandardPage>
    </TooltipProvider>
  )
}
