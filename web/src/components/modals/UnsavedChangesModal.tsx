import type { JSX } from 'preact';
import { resolveUnsavedChanges } from '../../actions/file.ts';
import { unsavedChangesPrompt } from '../../state/ui.ts';
import { Modal } from '../ui/Modal.tsx';

export function UnsavedChangesModal(): JSX.Element | string {
  const prompt = unsavedChangesPrompt.value;
  if (!prompt) {
    return '';
  }
  return (
    <Modal
      title="Unsaved changes"
      actions={[
        { label: 'Save', onClick: () => resolveUnsavedChanges('save') },
        { label: 'Discard', onClick: () => resolveUnsavedChanges('discard') },
        { label: 'Cancel', onClick: () => resolveUnsavedChanges('cancel') },
      ]}
    >
      <p>You have unsaved changes. Do you want to save before continuing?</p>
    </Modal>
  );
}
