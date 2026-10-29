import type { ComponentChildren, JSX } from 'preact';

const CELL_CLASS = 'py-1.5 px-2.5 border-b border-[var(--surface-hover)]';

export function DataTable(props: { headers: string[]; children: ComponentChildren }): JSX.Element {
  return (
    <table class="mt-3 w-full max-w-[800px] border-collapse">
      <thead>
        <tr>
          {props.headers.map((header) => (
            <th key={header} class={CELL_CLASS + ' text-left'}>
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{props.children}</tbody>
    </table>
  );
}

export function Cell(props: { children?: ComponentChildren }): JSX.Element {
  return <td class={CELL_CLASS}>{props.children}</td>;
}
