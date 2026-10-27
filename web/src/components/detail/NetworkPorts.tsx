import type { JSX } from 'preact';
import * as Schema from '../../lib/schema.ts';
import * as Store from '../../lib/store.ts';
import type { Entity } from '../../lib/schema.ts';
import type { PortRow } from '../../lib/store.ts';
import { Cell, DataTable } from '../ui/DataTable.tsx';
import { PageTitle } from '../ui/PageTitle.tsx';

function portStatusLabel(status: string): string {
  return status === 'faulty' ? 'Faulty' : status === 'occupied' ? 'Occupied' : 'Free';
}

export function NetworkPorts(props: { network: Entity }): JSX.Element {
  const { network } = props;
  const rows = Store.getPortsForNetwork(network.id as string);

  return (
    <div>
      <PageTitle>{(network.name as string) || '(unnamed)'} — Ports</PageTitle>
      <DataTable headers={['Port', 'Device', 'Status', 'Jack', 'Remark']}>
        {rows.map((row: PortRow) => {
          const status = Schema.portStatus(row.device, row.info);
          const statusColor = status === 'faulty' ? 'text-[firebrick]' : status === 'free' ? 'text-[seagreen]' : '';
          return (
            <tr
              key={row.port}
              class={'cursor-pointer hover:bg-[var(--surface-hover)] ' + statusColor}
              onDblClick={() => {
                Store.selectedKey.value = 'network:' + network.id + '/ports/' + row.port;
              }}
            >
              <Cell>{row.port}</Cell>
              <Cell>{row.device ? Schema.entityLabel('devices', row.device) : ''}</Cell>
              <Cell>{portStatusLabel(status)}</Cell>
              <Cell>{row.info.jack || ''}</Cell>
              <Cell>{row.info.remark || ''}</Cell>
            </tr>
          );
        })}
      </DataTable>
    </div>
  );
}
