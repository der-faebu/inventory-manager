import type { JSX } from 'preact';
import * as Store from '../../lib/store.ts';
import type { Entity } from '../../lib/schema.ts';
import { FieldRow } from '../ui/FieldTable.tsx';
import { TextInput } from '../ui/inputs.tsx';

export function DeviceSwitchPort(props: { device: Entity }): JSX.Element {
  const { device } = props;
  const jack = device.switch ? Store.getPortInfo(device.switch as string, device.port as string).jack || '' : '';

  return (
    <FieldRow label="Jack">
      <TextInput value={jack} readOnly />
    </FieldRow>
  );
}
