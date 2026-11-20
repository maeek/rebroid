import { FormField } from '@/components/ui/form-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export const ApkLibraryFilter = <T extends string>({
  label,
  value,
  options,
  onChange
}: {
  label: string
  value: T
  options: Record<T, string>
  onChange: (value: T) => void
}) => (
  <FormField
    label={label}
    layout='vertical'
    controlId={`apk-filter-${label.toLowerCase()}`}
  >
    <Select
      value={value}
      onValueChange={next => {
        if (next !== null) onChange(next)
      }}
    >
      <SelectTrigger
        id={`apk-filter-${label.toLowerCase()}`}
        className='w-full'
      >
        <SelectValue>{options[value]}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {Object.entries<string>(options).map(([key, text]) => (
          <SelectItem
            key={key}
            value={key}
          >
            {text}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </FormField>
)
