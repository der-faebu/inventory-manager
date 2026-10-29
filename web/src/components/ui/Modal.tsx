import type { ComponentChildren, JSX } from 'preact';
import { Button } from './Button.tsx';

export function Modal(props: {
  title: string;
  actions: { label: string; onClick: () => void }[];
  children?: ComponentChildren;
}): JSX.Element {
  return (
    <div class="fixed inset-0 z-[100] flex items-center justify-center bg-black/40">
      <div class="min-w-[320px] rounded-md bg-[var(--surface)] p-5 text-[color:var(--ink)] shadow-[0_8px_24px_rgba(0,0,0,0.2)]">
        <h3 class="mt-0">{props.title}</h3>
        {props.children}
        <div class="mt-4 flex justify-end gap-2">
          {props.actions.map((action) => (
            <Button key={action.label} variant="modal" onClick={action.onClick}>
              {action.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
