import { DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { EyeOff, GripVertical, Plus } from 'lucide-react';
import { useReorderCategories } from '../../hooks/useMenuMutations';

function CategoryRow({ category, selected, canEdit, onSelect }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: category.id, disabled: !canEdit });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center rounded-xl ${
        isDragging ? 'relative z-10 bg-white shadow-lg ring-1 ring-stone-300' : ''
      } ${selected ? 'bg-brand-50' : 'hover:bg-stone-50'}`}
    >
      {canEdit && (
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Reorder ${category.name}`}
          className="inline-flex h-11 w-9 shrink-0 cursor-grab touch-none items-center justify-center text-stone-500 hover:text-stone-900"
        >
          <GripVertical size={18} aria-hidden="true" />
        </button>
      )}
      <button
        type="button"
        onClick={() => onSelect(category.id)}
        aria-current={selected ? 'true' : undefined}
        className={`flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-xl text-left text-sm ${
          canEdit ? 'pr-3' : 'px-3'
        }`}
      >
        <span className={`truncate ${selected ? 'font-semibold text-brand-800' : 'text-stone-800'}`}>
          {category.name}
        </span>
        {!category.isActive && (
          <>
            <EyeOff size={14} aria-hidden="true" className="shrink-0 text-stone-600" />
            <span className="sr-only">Hidden from customers</span>
          </>
        )}
        <span className="ml-auto shrink-0 text-xs tabular-nums text-stone-600">{category.itemCount}</span>
      </button>
    </li>
  );
}

// One drag area per group, so a category can only be reordered inside its own group.
function CategoryGroup({ group, selectedId, canEdit, onSelect }) {
  const reorder = useReorderCategories();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = group.categories.map((c) => c.id);

  const onDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(active.id);
    const to = ids.indexOf(over.id);
    if (from < 0 || to < 0) return;
    reorder.mutate({ groupName: group.name, ids: arrayMove(ids, from, to) });
  };

  return (
    <section aria-label={group.name}>
      <h3 className="px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-stone-600">
        {group.name}
      </h3>
      <DndContext id={`dnd-${group.name}`} sensors={sensors} onDragEnd={onDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <ul>
            {group.categories.map((c) => (
              <CategoryRow
                key={c.id}
                category={c}
                selected={selectedId === c.id}
                canEdit={canEdit}
                onSelect={onSelect}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </section>
  );
}

export default function CategoryPanel({ groups, selectedId, totalItems, canEdit, open, onSelect, onAdd }) {
  return (
    <section
      id="category-panel"
      aria-label="Categories"
      className={`${open ? 'block' : 'hidden'} rounded-2xl bg-white p-3 shadow-sm ring-1 ring-stone-200 xl:block`}
    >
      <div className="flex items-center justify-between px-3">
        <h2 className="text-base font-semibold">Categories</h2>
        {canEdit && (
          <button
            type="button"
            onClick={onAdd}
            className="-mr-2 inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-brand-700 hover:bg-brand-50"
          >
            <Plus size={16} aria-hidden="true" />
            Add
          </button>
        )}
      </div>
      <div className="max-h-80 overflow-y-auto xl:max-h-[70dvh]">
        <button
          type="button"
          onClick={() => onSelect('all')}
          aria-current={selectedId === 'all' ? 'true' : undefined}
          className={`mt-1 flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm ${
            selectedId === 'all' ? 'bg-brand-50 font-semibold text-brand-800' : 'text-stone-800 hover:bg-stone-50'
          }`}
        >
          <span>All items</span>
          <span className="ml-auto text-xs tabular-nums text-stone-600">{totalItems}</span>
        </button>
        {groups.map((g) => (
          <CategoryGroup
            key={g.name}
            group={g}
            selectedId={selectedId}
            canEdit={canEdit}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  );
}