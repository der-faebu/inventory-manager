import type { ComponentChildren, JSX } from 'preact';

export function PageTitle(props: { children: ComponentChildren }): JSX.Element {
  return <h2 class="mt-0 text-[color:var(--accent-text)]">{props.children}</h2>;
}
