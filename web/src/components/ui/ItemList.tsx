import type { ComponentChildren, JSX } from 'preact';

export function ItemList(props: { children: ComponentChildren }): JSX.Element {
  return <ul class="m-0 mt-3 max-w-[600px] list-none p-0">{props.children}</ul>;
}

export function ListItem(props: { onClick: () => void; children: ComponentChildren }): JSX.Element {
  return (
    <li
      class="cursor-pointer border-b border-[var(--surface-hover)] py-1.5 px-2 hover:bg-[var(--surface-hover)]"
      onClick={props.onClick}
    >
      {props.children}
    </li>
  );
}
