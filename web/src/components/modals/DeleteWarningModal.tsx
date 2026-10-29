import type { JSX } from 'preact';
import * as Schema from '../../lib/schema.ts';
import * as Store from '../../lib/store.ts';
import { deletePrompt } from '../../state/ui.ts';
import { Modal } from '../ui/Modal.tsx';

export function DeleteWarningModal(): JSX.Element | string {
  const prompt = deletePrompt.value;
  if (!prompt) {
    return '';
  }
  const info = Schema.COLLECTIONS[prompt.collectionKey];
  const entity = Store.document.value[prompt.collectionKey].find((e) => e.id === prompt.id);
  return (
    <Modal
      title={'Delete ' + info.one.toLowerCase() + '?'}
      actions={[
        {
          label: 'Delete',
          onClick: () => {
            deletePrompt.value = null;
            Store.deleteEntity(prompt.collectionKey, prompt.id);
          },
        },
        { label: 'Cancel', onClick: () => (deletePrompt.value = null) },
      ]}
    >
      <p>
        <strong>{entity ? Schema.entityLabel(prompt.collectionKey, entity) : info.one}</strong> is linked to other
        entries. Deleting it removes these links:
      </p>
      <ul class="my-2 pl-5">
        {prompt.links.map((link) => (
          <li key={link.label}>
            {link.label}: {link.count}
          </li>
        ))}
      </ul>
    </Modal>
  );
}
