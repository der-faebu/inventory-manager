import type { JSX } from 'preact';
import { migrationWarning } from '../../state/ui.ts';
import { Modal } from '../ui/Modal.tsx';

export function MigrationWarningModal(): JSX.Element | string {
  const fields = migrationWarning.value;
  if (!fields) {
    return '';
  }
  return (
    <Modal title="Migration warning" actions={[{ label: 'OK', onClick: () => (migrationWarning.value = null) }]}>
      <p>The following fields from the legacy file were not recognized and were dropped:</p>
      <ul class="max-h-60 overflow-y-auto rounded bg-[var(--surface-sunk)] px-3 py-2 font-mono text-xs">
        {fields.map((field) => (
          <li key={field}>{field}</li>
        ))}
      </ul>
    </Modal>
  );
}
