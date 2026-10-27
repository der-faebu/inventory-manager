import type { JSX } from 'preact';
import { attachGlobalListeners } from '../actions/global-listeners.ts';
import { Detail } from './Detail.tsx';
import { Toolbar } from './Toolbar.tsx';
import { Tree } from './Tree.tsx';
import { ErrorModal } from './modals/ErrorModal.tsx';
import { MigrationWarningModal } from './modals/MigrationWarningModal.tsx';
import { SaveAsModal } from './modals/SaveAsModal.tsx';
import { UnsavedChangesModal } from './modals/UnsavedChangesModal.tsx';

export default function App(): JSX.Element {
  attachGlobalListeners();

  return (
    <div class="flex h-screen flex-col">
      <Toolbar />
      <div class="flex min-h-0 flex-1">
        <div class="w-[280px] overflow-y-auto border-r-2 border-[var(--border)] bg-[var(--surface-sunk)] py-2">
          <Tree />
        </div>
        <div class="flex-1 overflow-y-auto px-6 py-4">
          <Detail />
        </div>
      </div>
      <SaveAsModal />
      <UnsavedChangesModal />
      <ErrorModal />
      <MigrationWarningModal />
    </div>
  );
}
