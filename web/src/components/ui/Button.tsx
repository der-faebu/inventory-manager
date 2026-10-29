import type { ComponentChildren, JSX } from 'preact';

const VARIANT_CLASS = {
  plain: undefined,
  toolbar:
    'rounded-full border-none bg-[var(--surface)] px-4 py-[7px] text-[13px] font-semibold text-[color:var(--accent-text)] shadow-[0_1px_2px_rgba(0,0,0,0.15)] hover:bg-[var(--surface-sunk)]',
  modal:
    'rounded-full border border-[var(--border)] bg-[var(--surface)] px-3.5 py-1.5 text-[13px] font-semibold text-[color:var(--accent-text)] hover:bg-[var(--surface-sunk)]',
};

export function Button(props: {
  variant?: keyof typeof VARIANT_CLASS;
  class?: string;
  onClick: () => void;
  children: ComponentChildren;
}): JSX.Element {
  const classes = [VARIANT_CLASS[props.variant || 'plain'], props.class].filter(Boolean).join(' ');
  return (
    <button class={classes || undefined} onClick={props.onClick}>
      {props.children}
    </button>
  );
}
