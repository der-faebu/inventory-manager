import type { JSX } from 'preact';
import { confirmSaveAs } from '../../actions/file.ts';
import { saveAsPrompt } from '../../state/ui.ts';
import { Modal } from '../ui/Modal.tsx';

export function SaveAsModal(): JSX.Element | string {
  const prompt = saveAsPrompt.value;
  if (!prompt) {
    return '';
  }
  const nameValue = prompt.defaultName;
  return (
    <Modal
      title="Save As"
      actions={[
        { label: 'Save', onClick: () => confirmSaveAs(nameValue) },
        { label: 'Cancel', onClick: () => (saveAsPrompt.value = null) },
      ]}
    >
      <input
        type="text"
        class="w-full rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm text-[color:var(--ink)]"
        value={nameValue}
        onInput={(e: Event & { currentTarget: HTMLInputElement }) => {
          saveAsPrompt.value = Object.assign({}, prompt, { defaultName: e.currentTarget.value });
        }}
      />
    </Modal>
  );
}
