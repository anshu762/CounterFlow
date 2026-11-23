import { useMemo, useState } from 'react';
import { ChevronDown, Plus, Search, UtensilsCrossed } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import ErrorState from '../components/ui/ErrorState';
import CategoryPanel from '../components/menu/CategoryPanel';
import CategoryDialog from '../components/menu/CategoryDialog';
import ItemCard from '../components/menu/ItemCard';
import ItemDialog from '../components/menu/ItemDialog';
import { checkboxClass, inputClass, primaryButton, secondaryButton } from '../components/settings/styles';
import { useAdminMenu } from '../hooks/useAdminMenu';
import { describeError } from '../lib/errors';
import { DIETS, allCategories, itemMatches, menuStats, searchAll } from '../lib/menuData';
import { useSession } from '../lib/session';

const PAGE_SIZE = 48;
const GRID =
  'grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-2 min-[1380px]:grid-cols-3';

function MenuSkeleton() {
  return (
    <div role="status">
      <div className="mb-4 h-11 animate-pulse rounded-xl bg-white ring-1 ring-stone-200" />
      <div className="grid gap-4 xl:grid-cols-[18rem_minmax(0,1fr)] xl:gap-6">
        <div className="hidden h-96 animate-pulse rounded-2xl bg-white ring-1 ring-stone-200 xl:block" />
        <div className={GRID}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-72 animate-pulse rounded-2xl bg-white ring-1 ring-stone-200" />
          ))}
        </div>
      </div>
      <span className="sr-only">Loading menu</span>
    </div>
  );
}

function Empty({ title, message, children }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl bg-white px-6 py-12 text-center ring-1 ring-stone-200">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-700">
        <UtensilsCrossed size={24} aria-hidden="true" />
      </span>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="max-w-md text-sm text-stone-600">{message}</p>
      {children}
    </div>
  );
}

function MenuBrowser({ groups, canEdit }) {
  const categories = useMemo(() => allCategories(groups), [groups]);
  const stats = useMemo(() => menuStats(groups), [groups]);

  const [selectedId, setSelectedId] = useState(null); // null = first category, 'all' = whole menu
  const [query, setQuery] = useState('');
  const [diet, setDiet] = useState('all');
  const [unavailableOnly, setUnavailableOnly] = useState(false);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [listOpen, setListOpen] = useState(false);
  const [dialog, setDialog] = useState(null);

  const current =
    selectedId === 'all' ? null : (categories.find((c) => c.id === selectedId) ?? categories[0] ?? null);
  const searching = query.trim() !== '';
  const showAll = selectedId === 'all' || searching;
  const highlight = showAll ? (selectedId === 'all' ? 'all' : null) : (current?.id ?? null);
  const filtersActive = searching || diet !== 'all' || unavailableOnly;

  const entries = useMemo(() => {
    if (showAll) {
      return searchAll(groups, { query, diet, unavailableOnly }).map((r) => ({
        item: r.item,
        label: r.categoryName,
      }));
    }
    if (!current) return [];
    return current.items
      .filter((i) => itemMatches(i, { diet, unavailableOnly }))
      .map((item) => ({ item, label: null }));
  }, [groups, showAll, current, query, diet, unavailableOnly]);

  const visible = entries.slice(0, limit);

  const pickCategory = (id) => {
    setSelectedId(id);
    setQuery('');
    setLimit(PAGE_SIZE);
    setListOpen(false);
  };
  const changeQuery = (value) => {
    setQuery(value);
    setLimit(PAGE_SIZE);
  };
  const changeDiet = (value) => {
    setDiet(value);
    setLimit(PAGE_SIZE);
  };
  const changeUnavailable = (value) => {
    setUnavailableOnly(value);
    if (value) setSelectedId('all');
    setLimit(PAGE_SIZE);
  };
  const clearFilters = () => {
    setQuery('');
    setDiet('all');
    setUnavailableOnly(false);
    setLimit(PAGE_SIZE);
  };

  const openAddItem = () => setDialog({ type: 'item', item: null, categoryId: current?.id });
  const openAddCategory = () => setDialog({ type: 'category', category: null });

  const subtitle =
    `${stats.items} items in ${stats.categories} categories` +
    (stats.unavailable ? `, ${stats.unavailable} unavailable` : '') +
    (stats.hidden ? `, ${stats.hidden} hidden` : '');

  const dialogs = (
    <>
      {dialog?.type === 'item' && (
        <ItemDialog
          key={dialog.item?.id ?? 'new'}
          item={dialog.item}
          categoryId={dialog.categoryId}
          groups={groups}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.type === 'category' && (
        <CategoryDialog
          key={dialog.category?.id ?? 'new'}
          category={dialog.category}
          groups={groups}
          defaultGroup={current?.groupName}
          onClose={() => setDialog(null)}
          onSaved={(saved, created) => {
            if (created) pickCategory(saved.id);
          }}
        />
      )}
    </>
  );

  if (categories.length === 0) {
    return (
      <>
        <PageHeader title="Menu" subtitle="Categories, items and availability." />
        <Empty
          title="Your menu is empty"
          message={
            canEdit
              ? 'Start by adding a category, then add items to it.'
              : 'Ask the owner to add categories and items.'
          }
        >
          {canEdit && (
            <button type="button" onClick={openAddCategory} className={primaryButton}>
              <Plus size={18} aria-hidden="true" />
              Add category
            </button>
          )}
        </Empty>
        {dialogs}
      </>
    );
  }

  const heading = showAll ? (searching ? 'Search results' : 'All items') : current?.name;

  return (
    <>
      <PageHeader title="Menu" subtitle={subtitle} />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <label htmlFor="menu-search" className="sr-only">
            Search items by name
          </label>
          <Search
            size={18}
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500"
          />
          <input
            id="menu-search"
            type="search"
            value={query}
            onChange={(e) => changeQuery(e.target.value)}
            placeholder="Search all items"
            autoComplete="off"
            style={{ paddingLeft: '2.5rem' }}
            className={inputClass}
          />
        </div>
        <div role="group" aria-label="Diet filter" className="flex gap-1 rounded-xl bg-stone-100 p-1">
          {DIETS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={diet === value}
              onClick={() => changeDiet(value)}
              className={`min-h-11 flex-1 rounded-lg px-4 text-sm font-semibold ${
                diet === value ? 'bg-white text-brand-800 shadow-sm' : 'text-stone-700 hover:text-stone-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium text-stone-800">
          <input
            type="checkbox"
            className={checkboxClass}
            checked={unavailableOnly}
            onChange={(e) => changeUnavailable(e.target.checked)}
          />
          Unavailable only
        </label>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[18rem_minmax(0,1fr)] xl:gap-6">
        <div>
          <button
            type="button"
            aria-expanded={listOpen}
            aria-controls="category-panel"
            onClick={() => setListOpen((o) => !o)}
            className="mb-3 flex min-h-11 w-full items-center justify-between gap-3 rounded-xl bg-white px-4 text-left text-sm font-semibold shadow-sm ring-1 ring-stone-200 xl:hidden"
          >
            <span className="truncate">Category: {heading}</span>
            <ChevronDown
              size={18}
              aria-hidden="true"
              className={`shrink-0 transition-transform ${listOpen ? 'rotate-180' : ''}`}
            />
          </button>
          <CategoryPanel
            groups={groups}
            selectedId={highlight}
            totalItems={stats.items}
            canEdit={canEdit}
            open={listOpen}
            onSelect={pickCategory}
            onAdd={openAddCategory}
          />
        </div>

        <section aria-label="Items" className="min-w-0">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              {!showAll && current && (
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-600">
                  {current.groupName}
                </p>
              )}
              <h2 className="text-xl font-bold">{heading}</h2>
              {!showAll && current?.description && (
                <p className="mt-1 max-w-prose text-sm text-stone-600">{current.description}</p>
              )}
              {!showAll && current && !current.isActive && (
                <p className="mt-2 inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900 ring-1 ring-amber-200">
                  Hidden from customers
                </p>
              )}
              <p className="mt-1 text-sm text-stone-600">
                {entries.length} {entries.length === 1 ? 'item' : 'items'}
                {filtersActive ? ' match your filters' : ''}
              </p>
            </div>
            {canEdit && !showAll && current && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setDialog({ type: 'category', category: current })}
                  className={secondaryButton}
                >
                  Edit category
                </button>
                <button type="button" onClick={openAddItem} className={primaryButton}>
                  <Plus size={18} aria-hidden="true" />
                  Add item
                </button>
              </div>
            )}
          </div>

          <p role="status" className="sr-only">
            {entries.length} items shown
          </p>

          {entries.length === 0 ? (
            filtersActive ? (
              <Empty title="No items match" message="Try a different search or clear the filters.">
                <button type="button" onClick={clearFilters} className={secondaryButton}>
                  Clear filters
                </button>
              </Empty>
            ) : (
              <Empty
                title="No items in this category yet"
                message={canEdit ? 'Add the first item to this category.' : 'The owner has not added items here yet.'}
              >
                {canEdit && current && (
                  <button type="button" onClick={openAddItem} className={primaryButton}>
                    <Plus size={18} aria-hidden="true" />
                    Add item
                  </button>
                )}
              </Empty>
            )
          ) : (
            <>
              <ul className={GRID}>
                {visible.map(({ item, label }) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    categoryLabel={label}
                    canEdit={canEdit}
                    onEdit={(it) => setDialog({ type: 'item', item: it })}
                  />
                ))}
              </ul>
              {entries.length > visible.length && (
                <div className="mt-6 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setLimit((n) => n + PAGE_SIZE)}
                    className={secondaryButton}
                  >
                    Show more ({entries.length - visible.length} left)
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {dialogs}
    </>
  );
}

export default function MenuPage() {
  const canEdit = useSession((s) => s.role) === 'owner';
  const q = useAdminMenu();

  if (q.isPending) {
    return (
      <>
        <PageHeader title="Menu" subtitle="Categories, items and availability." />
        <MenuSkeleton />
      </>
    );
  }

  if (!q.data) {
    return (
      <>
        <PageHeader title="Menu" subtitle="Categories, items and availability." />
        <ErrorState
          title="Could not load the menu"
          message={describeError(q.error).message}
          onRetry={() => q.refetch()}
        />
      </>
    );
  }

  return <MenuBrowser groups={q.data} canEdit={canEdit} />;
}