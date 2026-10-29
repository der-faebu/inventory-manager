import type { ComponentChildren, JSX } from 'preact';

const LABEL_CLASS =
  'w-[180px] py-1.5 px-2 border-b border-[var(--surface-hover)] text-[12.5px] font-bold text-[color:var(--accent-text)]';
const VALUE_CLASS = 'py-1.5 px-2 border-b border-[var(--surface-hover)]';

export function FieldTable(props: { children: ComponentChildren }): JSX.Element {
  return (
    <table class="w-full max-w-[600px] border-collapse">
      <tbody>{props.children}</tbody>
    </table>
  );
}

export function FieldRow(props: { label: string; children: ComponentChildren }): JSX.Element {
  return (
    <tr>
      <td class={LABEL_CLASS}>{props.label}</td>
      <td class={VALUE_CLASS}>{props.children}</td>
    </tr>
  );
}
