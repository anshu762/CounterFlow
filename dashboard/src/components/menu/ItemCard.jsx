import { Pencil, UtensilsCrossed } from 'lucide-react';
import Switch from '../ui/Switch';
import { useSetAvailability } from '../../hooks/useMenuMutations';
import { formatPrice } from '../../lib/format';
import { BADGE_LABEL } from '../../lib/menuForm';

function VegMark({ isVeg }) {
  return (
    <span
      role="img"
      aria-label={isVeg ? 'Vegetarian' : 'Non-vegetarian'}
      className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border-2 ${
        isVeg ? 'border-emerald-700' : 'border-red-700'
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${isVeg ? 'bg-emerald-700' : 'bg-red-700'}`} />
    </span>
  );
}

export default function ItemCard({ item, categoryLabel, canEdit, onEdit }) {
  const availability = useSetAvailability();
  const sizes = item.variants?.length ?? 0;

  return (
    <li className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-stone-200">
      <div className="relative aspect-[4/3] bg-brand-50">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className={`h-full w-full object-cover ${item.isAvailable ? '' : 'grayscale'}`}
          />
        ) : (
          <div
            role="img"
            aria-label="No photo yet"
            className="flex h-full w-full items-center justify-center bg-linear-to-br from-brand-50 to-gold-50 text-brand-700"
          >
            <UtensilsCrossed size={36} aria-hidden="true" />
          </div>
        )}
        {!item.isAvailable && (
          <span className="absolute left-2 top-2 rounded-full bg-stone-900 px-2.5 py-1 text-xs font-semibold text-white">
            Unavailable
          </span>
        )}
        {item.badge && (
          <span className="absolute right-2 top-2 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-stone-800 shadow-sm ring-1 ring-gold-500">
            {BADGE_LABEL[item.badge] ?? item.badge}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start gap-2">
          <VegMark isVeg={item.isVeg} />
          <h3 className="min-w-0 font-semibold leading-snug text-stone-900">{item.name}</h3>
        </div>
        {categoryLabel && <p className="text-xs text-stone-600">{categoryLabel}</p>}
        <p className="text-sm text-stone-700">
          <span className="font-semibold text-stone-900">{formatPrice(item.price)}</span>
          {sizes > 0 && ` · ${sizes} ${sizes === 1 ? 'size' : 'sizes'}`}
          {` · ${item.prepTimeMinutes} min`}
        </p>

        <div className="mt-auto flex items-center justify-between border-t border-stone-100 pt-2">
          <span className="text-sm font-medium text-stone-800">
            {item.isAvailable ? 'Available' : 'Unavailable'}
          </span>
          <div className="flex items-center">
            {canEdit && (
              <button
                type="button"
                onClick={() => onEdit(item)}
                aria-label={`Edit ${item.name}`}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-stone-700 hover:bg-stone-100"
              >
                <Pencil size={18} aria-hidden="true" />
              </button>
            )}
            <Switch
              checked={item.isAvailable}
              busy={availability.isPending}
              label={`${item.name} available`}
              onChange={(isAvailable) => availability.mutate({ id: item.id, isAvailable })}
            />
          </div>
        </div>
      </div>
    </li>
  );
}