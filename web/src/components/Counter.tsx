import { signal } from '@preact/signals';

const count = signal(0);

export default function Counter() {
  return (
    <div class="flex items-center gap-4 rounded-lg border border-slate-300 p-4">
      <button
        class="rounded bg-slate-800 px-3 py-1 text-white hover:bg-slate-700"
        onClick={() => count.value--}
      >
        -
      </button>
      <span class="text-xl font-semibold tabular-nums">{count}</span>
      <button
        class="rounded bg-slate-800 px-3 py-1 text-white hover:bg-slate-700"
        onClick={() => count.value++}
      >
        +
      </button>
    </div>
  );
}
