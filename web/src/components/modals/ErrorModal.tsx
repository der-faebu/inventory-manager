import type { JSX } from 'preact';
import { errorMessage } from '../../state/ui.ts';
import { Modal } from '../ui/Modal.tsx';

export function ErrorModal(): JSX.Element | string {
  if (!errorMessage.value) {
    return '';
  }
  return (
    <Modal title="Error" actions={[{ label: 'OK', onClick: () => (errorMessage.value = '') }]}>
      <p>{errorMessage.value}</p>
    </Modal>
  );
}
