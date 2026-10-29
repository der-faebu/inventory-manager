import type { ComponentChildren, JSX } from 'preact';
import * as Schema from '../lib/schema.ts';
import * as Store from '../lib/store.ts';
import { expandedFolders, toggleFolder } from '../state/ui.ts';

function TreeLeaf(props: { selected: boolean; onClick: () => void; children: ComponentChildren }): JSX.Element {
  return (
    <li
      class={
        'mx-1.5 my-px cursor-pointer whitespace-nowrap rounded-[10px] px-2 py-1 text-[color:var(--ink)] hover:bg-[var(--surface-hover)]' +
        (props.selected ? ' bg-[var(--accent)] font-bold text-white hover:bg-[var(--accent)]' : '')
      }
      onClick={props.onClick}
    >
      {props.children}
    </li>
  );
}

export function Tree(): JSX.Element {
  const doc = Store.document.value;
  const selected = Store.selectedKey.value;
  const expanded = expandedFolders.value;

  const folderNodes = Schema.TREE_ORDER.map((key) => {
    const info = Schema.COLLECTIONS[key];
    const entities = doc[key] || [];
    const isExpanded = expanded[key] !== false;

    const childNodes = isExpanded
      ? entities.map((entity) => {
          const nodeKey = key + ':' + entity.id;
          return (
            <TreeLeaf
              key={nodeKey}
              selected={selected === nodeKey}
              onClick={() => {
                Store.selectedKey.value = nodeKey;
              }}
            >
              {Schema.entityLabel(key, entity)}
            </TreeLeaf>
          );
        })
      : [];

    return (
      <li key={key}>
        <div
          class={
            'mx-1.5 my-px flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-[10px] px-2 py-1 font-bold text-[color:var(--accent-text)] hover:bg-[var(--surface-hover)]' +
            (selected === key ? ' bg-[var(--accent)] text-white hover:bg-[var(--accent)]' : '')
          }
          onClick={() => {
            Store.selectedKey.value = key;
            if (expanded[key] === false) {
              toggleFolder(key);
            }
          }}
        >
          <span
            class="inline-block w-[1em]"
            onClick={(e: Event) => {
              e.stopPropagation();
              toggleFolder(key);
            }}
          >
            {isExpanded ? '▾' : '▸'}
          </span>
          <span data-icon={info.icon}></span>
          <span>{info.many}</span>
          <span class="ml-auto text-xs opacity-55">{entities.length}</span>
        </div>
        <ul class="list-none py-0 pl-4 pr-0 my-0">{childNodes}</ul>
      </li>
    );
  });

  return (
    <ul class="list-none m-0 p-0">
      <TreeLeaf
        selected={selected === 'customer'}
        onClick={() => {
          Store.selectedKey.value = 'customer';
        }}
      >
        {doc.customer.name || 'Customer'}
      </TreeLeaf>
      <ul class="list-none py-0 pl-4 pr-0 my-0">{folderNodes}</ul>
    </ul>
  );
}
