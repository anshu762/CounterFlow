import { DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import ItemCard from './ItemCard';
import { useReorderItems } from '../../hooks/useItemMutations';

function SortableCard({ entry, canEdit, onEdit }) {
  const { item, label } = entry;
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  const drag = {
    setNodeRef,
    isDragging,
    style: { transform: CSS.Translate.toString(transform), transition },
    handle: (
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${item.name}`}
        className="absolute bottom-2 left-2 inline-flex h-11 w-11 cursor-grab touch-none items-center justify-center rounded-xl bg-white/95 text-stone-700 shadow-sm ring-1 ring-stone-300 hover:text-stone-900"
      >
        <GripVertical size={18} aria-hidden="true" />
      </button>
    ),
  };

  return <ItemCard item={item} categoryLabel={label} canEdit={canEdit} onEdit={onEdit} drag={drag} />;
}

function SortableGrid({ categoryId, allIds, entries, canEdit, onEdit, className }) {
  const reorder = useReorderItems();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const visibleIds = entries.map((e) => e.item.id);
  const names = new Map(entries.map((e) => [e.item.id, e.item.name]));
  const nameOf = (id) => names.get(id) ?? 'item';
  const place = (id) => `position ${allIds.indexOf(id) + 1} of ${allIds.length}`;

  const announcements = {
    onDragStart: ({ active }) => `Picked up ${nameOf(active.id)}. It is at ${place(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over
        ? `${nameOf(active.id)} is over ${nameOf(over.id)}, ${place(over.id)}.`
        : `${nameOf(active.id)} is no longer over a position.`,
    onDragEnd: ({ active, over }) =>
      over
        ? `${nameOf(active.id)} was dropped at ${place(over.id)}.`
        : `${nameOf(active.id)} was dropped. The order did not change.`,
    onDragCancel: ({ active }) => `Reordering cancelled. ${nameOf(active.id)} did not move.`,
  };

  const onDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const from = allIds.indexOf(active.id);
    const to = allIds.indexOf(over.id);
    if (from < 0 || to < 0) return;
    reorder.mutate({ categoryId, ids: arrayMove(allIds, from, to) });
  };

  return (
    <DndContext
      id={`dnd-items-${categoryId}`}
      sensors={sensors}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable:
            'To reorder, press Space or Enter on the handle, move with the arrow keys, then press Space or Enter again to drop. Press Escape to cancel.',
        },
      }}
      onDragEnd={onDragEnd}
    >
      <SortableContext items={visibleIds} strategy={rectSortingStrategy}>
        <ul className={className}>
          {entries.map((entry) => (
            <SortableCard key={entry.item.id} entry={entry} canEdit={canEdit} onEdit={onEdit} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

// entries = [{ item, label }] currently shown. allIds = every item id of the category, in order.
// Dragging is only offered when `reorderable` (owner, one category, no filters).
export default function ItemGrid({ categoryId, allIds, entries, canEdit, reorderable, onEdit, className }) {
  if (!reorderable) {
    return (
      <ul className={className}>
        {entries.map(({ item, label }) => (
          <ItemCard key={item.id} item={item} categoryLabel={label} canEdit={canEdit} onEdit={onEdit} />
        ))}
      </ul>
    );
  }
  return (
    <SortableGrid
      categoryId={categoryId}
      allIds={allIds}
      entries={entries}
      canEdit={canEdit}
      onEdit={onEdit}
      className={className}
    />
  );
}