import type { JSX } from 'preact';
import * as Schema from '../../lib/schema.ts';
import * as Store from '../../lib/store.ts';
import type { CollectionKey, Entity } from '../../lib/schema.ts';
import { deletePrompt } from '../../state/ui.ts';
import { Button } from '../ui/Button.tsx';
import { FieldRow, FieldTable } from '../ui/FieldTable.tsx';
import { PageTitle } from '../ui/PageTitle.tsx';
import { DeviceMonitors } from './DeviceMonitors.tsx';
import { DeviceSwitchPort } from './DeviceSwitchPort.tsx';
import { EntityAssociations } from './EntityAssociations.tsx';
import { FieldInput } from './FieldInput.tsx';

export function EntityDetail(props: { collectionKey: CollectionKey; entity: Entity }): JSX.Element {
  const { collectionKey, entity } = props;
  const fields = Schema.COLLECTION_FIELDS[collectionKey];

  function onChange(fieldKey: string, value: string): void {
    if (collectionKey === 'devices' && (fieldKey === 'switch' || fieldKey === 'port')) {
      const networkId = fieldKey === 'switch' ? value : (entity.switch as string);
      const port = fieldKey === 'port' ? value : (entity.port as string);
      if (networkId && port) {
        Store.assignDevicePort(networkId, port, entity.id as string);
        return;
      }
    }
    Store.updateEntity(collectionKey, entity.id as string, { [fieldKey]: value });
  }

  return (
    <div>
      <PageTitle>{Schema.entityLabel(collectionKey, entity)}</PageTitle>
      <FieldTable>
        {fields.map((field) => (
          <FieldRow key={field.key} label={field.label}>
            <FieldInput field={field} value={entity[field.key] as string} onChange={(value) => onChange(field.key, value)} />
          </FieldRow>
        ))}
        {collectionKey === 'devices' ? <DeviceSwitchPort device={entity} /> : ''}
      </FieldTable>
      {collectionKey === 'devices' ? <DeviceMonitors device={entity} /> : ''}
      {collectionKey === 'network' && parseInt(entity.portCount as string, 10) > 0 ? (
        <Button
          onClick={() => {
            Store.selectedKey.value = 'network:' + entity.id + '/ports';
          }}
        >
          Ports
        </Button>
      ) : (
        ''
      )}
      <EntityAssociations collectionKey={collectionKey} entity={entity} />
      <Button
        class="mt-4"
        onClick={() => {
          const links = Store.entityLinks(collectionKey, entity.id as string);
          if (links.length > 0) {
            deletePrompt.value = { collectionKey, id: entity.id as string, links };
          } else {
            Store.deleteEntity(collectionKey, entity.id as string);
          }
        }}
      >
        Delete
      </Button>
    </div>
  );
}
