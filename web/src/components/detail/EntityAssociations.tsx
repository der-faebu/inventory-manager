import type { JSX } from 'preact';
import * as Schema from '../../lib/schema.ts';
import * as Store from '../../lib/store.ts';
import type { Association, CollectionKey, Entity } from '../../lib/schema.ts';
import { CheckboxList } from '../ui/CheckboxList.tsx';

function AssociationChecklist(props: { association: Association; owner: Entity }): JSX.Element {
  const { association, owner } = props;
  const targetEntities = Store.document.value[association.targetCollection];
  const assignedIds = (owner[association.fieldKey] as string[]) || [];

  return (
    <CheckboxList
      title={association.label}
      items={targetEntities.map((entity) => ({
        id: entity.id as string,
        label: Schema.entityLabel(association.targetCollection, entity),
        checked: assignedIds.includes(entity.id as string),
      }))}
      onToggle={(id) => Store.toggleAssociation(association, owner.id as string, id)}
      onCreate={() => {
        const entity = Store.addEntityAssociated(association, owner.id as string);
        Store.selectedKey.value = association.targetCollection + ':' + entity.id;
      }}
    />
  );
}

function ReverseAssociationList(props: { association: Association; target: Entity }): JSX.Element {
  const { association, target } = props;
  const owners = Store.document.value[association.ownerCollection];
  const ownerInfo = Schema.COLLECTIONS[association.ownerCollection];

  return (
    <CheckboxList
      title={ownerInfo.many}
      items={owners.map((owner) => ({
        id: owner.id as string,
        label: Schema.entityLabel(association.ownerCollection, owner),
        checked: ((owner[association.fieldKey] as string[]) || []).includes(target.id as string),
      }))}
      onToggle={(id) => Store.toggleAssociation(association, id, target.id as string)}
    />
  );
}

export function EntityAssociations(props: { collectionKey: CollectionKey; entity: Entity }): JSX.Element | string {
  const { collectionKey, entity } = props;

  const forward = Schema.ASSOCIATIONS.filter((association) => association.ownerCollection === collectionKey);
  const reverse = Schema.ASSOCIATIONS.filter((association) => association.targetCollection === collectionKey);

  if (forward.length === 0 && reverse.length === 0) {
    return '';
  }

  return (
    <div>
      {forward.map((association) => (
        <AssociationChecklist key={association.fieldKey} association={association} owner={entity} />
      ))}
      {reverse.map((association) => (
        <ReverseAssociationList key={association.fieldKey} association={association} target={entity} />
      ))}
    </div>
  );
}
