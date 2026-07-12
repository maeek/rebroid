import { IconDeviceFloppy, IconLoader2 } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Section } from '@/components/ui/section'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Visible } from '@/components/ui/visible'
import { RuntimeImagePicker } from '@/shared/ui/runtime-image/runtime-image-picker'
import type { BuilderValues } from '../model/builder-values'
import type { ContainerImageBuildRecipe, PlatformImage } from '@/server/orchestrator/platform/types'

const verticalSettingClassName = 'flex-col items-start w-full'

type RecipeSectionProps = {
  images: PlatformImage[]
  isSavingRecipe: boolean
  recipes: ContainerImageBuildRecipe[]
  values: BuilderValues
  onApplyTemplate: (androidVersion: string) => void
  onPatchValues: (patch: Partial<BuilderValues>) => void
  onSaveRecipe: () => void
  onSelectRecipe: (id: string) => void
}

export const RecipeSection = ({
  images,
  isSavingRecipe,
  recipes,
  values,
  onApplyTemplate,
  onPatchValues,
  onSaveRecipe,
  onSelectRecipe
}: RecipeSectionProps) => (
  <Section
    surface='plain'
    title='Recipe'
    contentClassName='gap-4'
  >
    <div className='grid grid-cols-2 gap-2'>
      <Button
        type='button'
        variant='secondary'
        onClick={() => onApplyTemplate('14')}
      >
        Android 14
      </Button>
      <Button
        type='button'
        variant='secondary'
        onClick={() => onApplyTemplate('13')}
      >
        Android 13
      </Button>
    </div>
    <Visible when={recipes.length > 0}>
      <Select onValueChange={onSelectRecipe}>
        <SelectTrigger className='w-full'>
          <SelectValue placeholder='Saved recipes' />
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
    </Visible>
    <FormField
      label='Name'
      layout='vertical'
      className={verticalSettingClassName}
    >
      <Input
        value={values.name}
        onChange={event => onPatchValues({ name: event.target.value })}
      />
    </FormField>
    <FormField
      label='Target image'
      layout='vertical'
      className={verticalSettingClassName}
    >
      <Input
        value={values.targetImage}
        onChange={event => onPatchValues({ targetImage: event.target.value })}
      />
    </FormField>
    <FormField
      label='Base image'
      layout='vertical'
      className={verticalSettingClassName}
    >
      <RuntimeImagePicker
        images={images}
        value={values.baseImage}
        onChange={baseImage => onPatchValues({ baseImage })}
      />
    </FormField>
    <div className='grid grid-cols-2 gap-3'>
      <FormField
        label='Android'
        layout='vertical'
        className={verticalSettingClassName}
      >
        <Input
          value={values.androidVersion}
          onChange={event => onPatchValues({ androidVersion: event.target.value })}
        />
      </FormField>
      <FormField
        label='Arch'
        layout='vertical'
        className={verticalSettingClassName}
      >
        <Input
          value={values.architecture}
          onChange={event => onPatchValues({ architecture: event.target.value })}
        />
      </FormField>
    </div>
    <FormField
      label='Signature spoofing'
      layout='vertical'
      className={verticalSettingClassName}
    >
      <Select
        value={values.signatureSpoofing}
        onValueChange={signatureSpoofing => onPatchValues({ signatureSpoofing: signatureSpoofing })}
      >
        <SelectTrigger className='w-full'>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value='external_required'>External required</SelectItem>
          <SelectItem value='present_unverified'>Present unverified</SelectItem>
          <SelectItem value='verified'>Verified</SelectItem>
          <SelectItem value='not_applicable'>Not applicable</SelectItem>
        </SelectContent>
      </Select>
    </FormField>
    <div className='flex flex-wrap gap-2'>
      <Button
        type='button'
        variant='secondary'
        disabled={isSavingRecipe}
        onClick={onSaveRecipe}
      >
        {isSavingRecipe ? <IconLoader2 className='size-4 animate-spin' /> : <IconDeviceFloppy />}
        Save recipe
      </Button>
    </div>
  </Section>
)
