import * as Schema from '../../lib/schema.ts';
import * as Store from '../../lib/store.ts';
import type { CollectionKey } from '../../lib/schema.ts';

export function refOptions(collection: CollectionKey): { value: string; label: string }[] {
  return (Store.document.value[collection] || []).map((entity) => ({
    value: entity.id as string,
    label: Schema.entityLabel(collection, entity),
  }));
}
