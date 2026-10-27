import type { JSX } from 'preact';
import * as Schema from '../../lib/schema.ts';
import * as Store from '../../lib/store.ts';
import type { CollectionKey } from '../../lib/schema.ts';
import { Button } from '../ui/Button.tsx';
import { ItemList, ListItem } from '../ui/ItemList.tsx';
import { PageTitle } from '../ui/PageTitle.tsx';

export function EntityList(props: { collectionKey: CollectionKey }): JSX.Element {
  const { collectionKey } = props;
  const info = Schema.COLLECTIONS[collectionKey];
  const entities = Store.document.value[collectionKey];
  return (
    <div>
      <PageTitle>{info.many}</PageTitle>
      <Button
        onClick={() => {
          const entity = Store.addEntity(collectionKey);
          Store.selectedKey.value = collectionKey + ':' + entity.id;
        }}
      >
        + New: {info.one}
      </Button>
      <ItemList>
        {entities.map((entity) => (
          <ListItem
            key={entity.id}
            onClick={() => {
              Store.selectedKey.value = collectionKey + ':' + entity.id;
            }}
          >
            {Schema.entityLabel(collectionKey, entity)}
          </ListItem>
        ))}
      </ItemList>
    </div>
  );
}
