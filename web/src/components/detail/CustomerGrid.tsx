import type { JSX } from 'preact';
import * as Schema from '../../lib/schema.ts';
import * as Store from '../../lib/store.ts';
import { FieldRow, FieldTable } from '../ui/FieldTable.tsx';
import { TextInput } from '../ui/inputs.tsx';
import { PageTitle } from '../ui/PageTitle.tsx';

export function CustomerGrid(): JSX.Element {
  const customer = Store.document.value.customer;

  return (
    <div>
      <PageTitle>Customer</PageTitle>
      <FieldTable>
        {Schema.CUSTOMER_FIELDS.map((field) => (
          <FieldRow key={field.key} label={field.label}>
            <TextInput
              value={(customer as unknown as Record<string, string>)[field.key] || ''}
              onInput={(value) => {
                Store.updateCustomer({ [field.key]: value });
              }}
            />
          </FieldRow>
        ))}
      </FieldTable>
    </div>
  );
}
