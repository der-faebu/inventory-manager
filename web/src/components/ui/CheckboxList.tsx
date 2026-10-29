import type { JSX } from 'preact';
import { Button } from './Button.tsx';

export function CheckboxList(props: {
  title: string;
  items: { id: string; label: string; checked: boolean }[];
  onToggle: (id: string) => void;
  onCreate?: () => void;
}): JSX.Element {
  return (
    <div class="mt-4 max-w-[600px] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
      <div class="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface-sunk)] px-3 py-2">
        <h3 class="m-0 text-xs font-bold uppercase tracking-wide text-[color:var(--accent-text)]">{props.title}</h3>
        {props.onCreate ? (
          <Button variant="modal" class="!px-3 !py-0.5 !text-xs" onClick={props.onCreate}>
            + New
          </Button>
        ) : (
          ''
        )}
      </div>
      {props.items.length === 0 ? (
        <p class="m-0 px-3 py-2 text-[13px] italic opacity-60">Nothing to link yet.</p>
      ) : (
        <ul class="m-0 max-h-[240px] list-none overflow-y-auto p-0">
          {props.items.map((item) => (
            <li key={item.id} class="border-b border-[var(--surface-hover)] last:border-b-0">
              <label class="flex cursor-pointer items-center gap-2 px-3 py-1.5 hover:bg-[var(--surface-hover)]">
                <input
                  class="accent-[var(--accent)]"
                  type="checkbox"
                  checked={item.checked}
                  onChange={() => props.onToggle(item.id)}
                />
                {item.label}
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
