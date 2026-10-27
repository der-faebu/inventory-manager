import type { JSX } from 'preact';
import * as Schema from '../lib/schema.ts';
import * as Store from '../lib/store.ts';
import { CustomerGrid } from './detail/CustomerGrid.tsx';
import { EntityDetail } from './detail/EntityDetail.tsx';
import { EntityList } from './detail/EntityList.tsx';
import { NetworkPorts } from './detail/NetworkPorts.tsx';
import { PortDetail } from './detail/PortDetail.tsx';

export function Detail(): JSX.Element {
  const selected = Store.selectedKey.value;
  if (selected === 'customer') {
    return <CustomerGrid />;
  }

  const portsMatch = /^network:([^/]+)\/ports(?:\/(\d+))?$/.exec(selected);
  if (portsMatch) {
    const network = Store.document.value.network.find((n) => n.id === portsMatch[1]);
    if (network) {
      return portsMatch[2] ? (
        <PortDetail network={network} port={parseInt(portsMatch[2], 10)} />
      ) : (
        <NetworkPorts network={network} />
      );
    }
  }

  const collectionKey = Schema.ALL_COLLECTION_KEYS.find(
    (key) => selected === key || selected.indexOf(key + ':') === 0,
  );

  if (collectionKey && selected === collectionKey) {
    return <EntityList collectionKey={collectionKey} />;
  }

  if (collectionKey) {
    const id = selected.slice((collectionKey + ':').length);
    const entity = Store.document.value[collectionKey].find((e) => e.id === id);
    if (entity) {
      return <EntityDetail collectionKey={collectionKey} entity={entity} />;
    }
  }

  return (
    <div>
      <p>Nothing to show yet.</p>
    </div>
  );
}
