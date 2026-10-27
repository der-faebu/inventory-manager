import type { ComponentChildren, JSX } from 'preact';

const INPUT_CLASS =
  'w-full rounded-lg border-2 border-[var(--border)] bg-[var(--surface)] px-1.5 py-1 text-sm text-[color:var(--ink)]';

function inputClass(invalid: boolean | undefined, extra: string | undefined): string {
  const base = invalid ? INPUT_CLASS.replace('border-[var(--border)]', 'border-[#c0392b]') : INPUT_CLASS;
  return extra ? base + ' ' + extra : base;
}

export function TextInput(props: {
  value: string;
  onInput?: (value: string) => void;
  readOnly?: boolean;
  invalid?: boolean;
  class?: string;
}): JSX.Element {
  return (
    <input
      type="text"
      class={inputClass(props.invalid, props.class)}
      value={props.value}
      readOnly={props.readOnly}
      onInput={(e: Event & { currentTarget: HTMLInputElement }) => {
        props.onInput?.(e.currentTarget.value);
      }}
    />
  );
}

export function SelectInput(props: {
  onChange: (value: string) => void;
  children: ComponentChildren;
}): JSX.Element {
  return (
    <select
      class={inputClass(false, undefined)}
      onChange={(e: Event & { currentTarget: HTMLSelectElement }) => {
        props.onChange(e.currentTarget.value);
      }}
    >
      {props.children}
    </select>
  );
}

export function FieldError(props: { message: string | null | undefined }): JSX.Element | string {
  return props.message ? <div class="mt-1 text-xs text-[#c0392b]">{props.message}</div> : '';
}

export function DateInput(props: {
  value: string;
  onInput: (value: string) => void;
  invalid?: boolean;
}): JSX.Element {
  return (
    <input
      type="date"
      class={inputClass(props.invalid, '[color-scheme:light_dark]')}
      value={props.value}
      onInput={(e: Event & { currentTarget: HTMLInputElement }) => {
        props.onInput(e.currentTarget.value);
      }}
    />
  );
}
