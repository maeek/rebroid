import { useState } from 'react'
import { IconDeviceFloppy } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { MutationButton } from '@/components/ui/mutation-button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { PlatformResourceSection } from '@/shared/ui/platform/platform-resource-section'
import { RuntimeImagePicker } from '@/shared/ui/runtime-image/runtime-image-picker'
import type { BuilderValues } from '../model/builder-values'
import type { ContainerImageBuildRecipe, PlatformImage } from '@/shared/contracts/platform'

type RecipeSectionProps = {
  images: PlatformImage[]
  isSavingRecipe: boolean
  recipes: ContainerImageBuildRecipe[]
  values: BuilderValues
  onApplyTemplate: (version: string) => void
  onPatchValues: (patch: Partial<BuilderValues>) => void
  onSaveRecipe: () => void
  onSelectRecipe: (id: string) => void
  disabled?: boolean
  loading?: boolean
}
export const RecipeSection = ({
  images,
  isSavingRecipe,
  recipes,
  values,
  onApplyTemplate,
  onPatchValues,
  onSaveRecipe,
  onSelectRecipe,
  disabled = false,
  loading = false
}: RecipeSectionProps) => {
  const [template, setTemplate] = useState('14')
  return (
    <PlatformResourceSection
      surface='plain'
      title='Image recipe'
      description='Name the output image and configure its runtime metadata.'
      contentClassName='gap-6'
    >
      <FormField
        controlId='builder-template'
        label='Starter template'
        description='Applying a template replaces the recipe fields and Dockerfile.'
        layout='vertical'
      >
        <Select
          value={template}
          disabled={disabled || loading}
          onValueChange={setTemplate}
        >
          <SelectTrigger className='w-full'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='14'>Android 14 · microG overlay</SelectItem>
            <SelectItem value='13'>Android 13 · microG overlay</SelectItem>
          </SelectContent>
        </Select>
      </FormField>
      <Button
        type='button'
        variant='secondary'
        className='self-start'
        disabled={disabled || loading}
        onClick={() => onApplyTemplate(template)}
      >
        Apply template
      </Button>
      {recipes.length > 0 ? (
        <FormField
          controlId='builder-saved-recipe'
          label='Load saved recipe'
          description='Replaces the current recipe and selected files.'
          layout='vertical'
        >
          <Select
            disabled={disabled || loading}
            onValueChange={onSelectRecipe}
          >
            <SelectTrigger className='w-full'>
              <SelectValue placeholder='Choose a saved recipe' />
            </SelectTrigger>
            <SelectContent>
              {recipes.map(recipe => (
                <SelectItem
                  key={recipe.id}
                  value={recipe.id}
                >
                  {recipe.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      ) : null}
      <FormField
        controlId='builder-name'
        label='Recipe name'
        description='A recognizable name for reusing this configuration.'
        layout='vertical'
      >
        {loading ? (
          <Skeleton className='h-9 w-full' />
        ) : (
          <Input
            value={values.name}
            disabled={disabled}
            onChange={event => onPatchValues({ name: event.target.value })}
          />
        )}
      </FormField>
      <FormField
        controlId='builder-target-image'
        label='Target image'
        description='Local image name and tag to create.'
        layout='vertical'
      >
        {loading ? (
          <Skeleton className='h-9 w-full' />
        ) : (
          <Input
            value={values.targetImage}
            disabled={disabled}
            onChange={event => onPatchValues({ targetImage: event.target.value })}
          />
        )}
      </FormField>
      <FormField
        controlId='builder-base-image'
        label='Base image'
        description='Keep the Dockerfile FROM instruction aligned with this metadata.'
        layout='vertical'
      >
        {loading ? (
          <Skeleton className='h-9 w-full' />
        ) : (
          <RuntimeImagePicker
            images={images}
            value={values.baseImage}
            disabled={disabled}
            onChange={baseImage => onPatchValues({ baseImage })}
          />
        )}
      </FormField>
      <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2'>
        <FormField
          controlId='builder-android-version'
          label='Android version'
          layout='vertical'
        >
          <Input
            disabled={disabled || loading}
            value={loading ? '' : values.androidVersion}
            onChange={event => onPatchValues({ androidVersion: event.target.value })}
          />
        </FormField>
        <FormField
          controlId='builder-architecture'
          label='Architecture'
          layout='vertical'
        >
          <Input
            disabled={disabled || loading}
            value={loading ? '' : values.architecture}
            onChange={event => onPatchValues({ architecture: event.target.value })}
          />
        </FormField>
      </div>
      <FormField
        controlId='builder-signature-spoofing'
        label='Signature spoofing'
        description='Describes support in the base image. An overlay cannot add framework support.'
        layout='vertical'
      >
        <Select
          value={values.signatureSpoofing}
          disabled={disabled || loading}
          onValueChange={signatureSpoofing => onPatchValues({ signatureSpoofing })}
        >
          <SelectTrigger className='w-full'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='external_required'>Required in base image</SelectItem>
            <SelectItem value='present_unverified'>Present · not verified</SelectItem>
            <SelectItem value='verified'>Verified</SelectItem>
            <SelectItem value='not_applicable'>Not applicable</SelectItem>
          </SelectContent>
        </Select>
      </FormField>
      <MutationButton
        type='button'
        variant='secondary'
        className='self-start'
        disabled={disabled || loading}
        pending={isSavingRecipe}
        pendingLabel='Saving recipe…'
        onClick={onSaveRecipe}
      >
        <IconDeviceFloppy className='size-4' /> Save recipe
      </MutationButton>
    </PlatformResourceSection>
  )
}
