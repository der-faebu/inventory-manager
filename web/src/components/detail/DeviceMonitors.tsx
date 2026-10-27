import type { JSX } from 'preact';
import * as Schema from '../../lib/schema.ts';
import * as Store from '../../lib/store.ts';
import type { Entity } from '../../lib/schema.ts';
import { Button } from '../ui/Button.tsx';
import { ItemList, ListItem } from '../ui/ItemList.tsx';

export function DeviceMonitors(props: { device: Entity }): JSX.Element {
  const { device } = props;
  const monitors = Store.document.value.monitors.filter((monitor) => monitor.device === device.id);

  return (
    <div>
      <h3>Monitors</h3>
      <Button
        onClick={() => {
          const monitor = Store.addMonitorForDevice(device.id as string);
          Store.selectedKey.value = 'monitors:' + monitor.id;
        }}
      >
        + Monitor
      </Button>
      <ItemList>
        {monitors.map((monitor) => (
          <ListItem
            key={monitor.id}
            onClick={() => {
              Store.selectedKey.value = 'monitors:' + monitor.id;
            }}
          >
            {Schema.entityLabel('monitors', monitor)}
          </ListItem>
        ))}
      </ItemList>
    </div>
  );
}
