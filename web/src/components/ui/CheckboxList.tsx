import type { JSX } from 'preact';
import { Button } from './Button.tsx';

export function CheckboxList(props: {
  title: string;
  items: { id: string; label: string; checked: boolean }[];
  onToggle: (id: string) => void;
  onCreate?: () => void;
}): JSX.Element {
  return (
    <div>
      <h3>{props.title}</h3>
      {props.onCreate ? <Button onClick={props.onCreate}>+ New</Button> : ''}
      <ul class="list-none m-0 p-0">
        {props.items.map((item) => (
          <li key={item.id}>
            <label>
              <input type="checkbox" checked={item.checked} onChange={() => props.onToggle(item.id)} />
              {item.label}
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
