import type { JSX } from 'preact';
import * as Schema from '../../lib/schema.ts';
import type { CollectionKey, Field } from '../../lib/schema.ts';
import { DateInput, FieldError, SelectInput, TextInput } from '../ui/inputs.tsx';
import { refOptions } from './ref-options.ts';

export function FieldInput(props: {
  field: Field;
  value: string;
  onChange: (value: string) => void;
}): JSX.Element {
  const { field, value, onChange } = props;

  if (field.type === 'select') {
    return (
      <SelectInput onChange={onChange}>
        <option value="">—</option>
        {(field.options || []).map((option) => (
          <option key={option} value={option} selected={value === option}>
            {option}
          </option>
        ))}
      </SelectInput>
    );
  }

  if (field.type === 'ref') {
    const options = refOptions(field.collection as CollectionKey);
    return (
      <SelectInput onChange={onChange}>
        <option value="">—</option>
        {options.map((option) => (
          <option key={option.value} value={option.value} selected={value === option.value}>
            {option.label}
          </option>
        ))}
      </SelectInput>
    );
  }

  const error = Schema.fieldError(field, value);

  if (field.type === 'date') {
    return (
      <>
        <DateInput
          invalid={!!error}
          value={Schema.dateToInputValue(value)}
          onInput={(v) => onChange(Schema.dateFromInputValue(v))}
        />
        <FieldError message={error} />
      </>
    );
  }

  return (
    <>
      <TextInput invalid={!!error} value={value || ''} onInput={onChange} />
      <FieldError message={error} />
    </>
  );
}
