import type { JSX } from 'preact';
import * as Schema from '../../lib/schema.ts';
import * as Store from '../../lib/store.ts';
import type { Entity } from '../../lib/schema.ts';
import { FieldRow, FieldTable } from '../ui/FieldTable.tsx';
import { SelectInput, TextInput } from '../ui/inputs.tsx';
import { PageTitle } from '../ui/PageTitle.tsx';
import { refOptions } from './ref-options.ts';

export function PortDetail(props: { network: Entity; port: number }): JSX.Element {
  const { network, port } = props;
  const networkId = network.id as string;
  const row = Store.getPortRow(networkId, port);
  const deviceOptions = refOptions('devices');

  return (
    <div>
      <PageTitle>
        {(network.name as string) || '(unnamed)'} — Port {port}
      </PageTitle>
      <FieldTable>
        <FieldRow label="Device">
          <SelectInput onChange={(value) => Store.assignDevicePort(networkId, port, value)}>
            <option value="">—</option>
            {deviceOptions.map((option) => (
              <option key={option.value} value={option.value} selected={!!row.device && row.device.id === option.value}>
                {option.label}
              </option>
            ))}
          </SelectInput>
        </FieldRow>
        <FieldRow label="Status">
          <SelectInput onChange={(value) => Store.setPortInfo(networkId, port, { status: value })}>
            <option value="" selected={!row.info.status}>
              —
            </option>
            {Schema.MANUAL_PORT_STATUSES.map((option) => (
              <option key={option} value={option} selected={row.info.status === option}>
                {option}
              </option>
            ))}
          </SelectInput>
        </FieldRow>
        <FieldRow label="Jack">
          <TextInput value={row.info.jack || ''} onInput={(value) => Store.setPortInfo(networkId, port, { jack: value })} />
        </FieldRow>
        <FieldRow label="Remark">
          <TextInput
            value={row.info.remark || ''}
            onInput={(value) => Store.setPortInfo(networkId, port, { remark: value })}
          />
        </FieldRow>
      </FieldTable>
    </div>
  );
}
