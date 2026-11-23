import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { TriangleAlert } from 'lucide-react';
import Modal from '../ui/Modal';
import ConfirmDialog from '../ui/ConfirmDialog';
import Spinner from '../ui/Spinner';
import { dangerButton } from '../ui/buttons';
import Field from '../settings/Field';
import { checkboxClass, inputClass, primaryButton, secondaryButton } from '../settings/styles';
import { useDeleteItem, useSaveItem } from '../../hooks/useMenuMutations';
import { describeError } from '../../lib/errors';
import { toast } from '../../lib/toast';
import {
  BADGES,
  diffItem,
  formToItemPayload,
  itemFormSchema,
  itemToForm,
} from '../../lib/menuForm';

// `item` is null when adding. `categoryId` pre-selects the category for a new item.
export default function ItemDialog({ item, categoryId, groups, onClose }) {
  const qc = useQueryClient();
  const isEdit = Boolean(item);
  const [base] = useState(() =>
    itemToForm(item, {
      categoryId: categoryId ?? '',
      defaultGst: qc.getQueryData(['settings'])?.defaultGstPercent ?? 5,
    }),
  );
  const [serverError, setServerError] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const save = useSaveItem();
  const del = useDeleteItem();

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(itemFormSchema),
    defaultValues: base,
    mode: 'onTouched',
  });

  const values = useWatch({ control });
  const dirty = Object.keys(diffItem(values, base)).length > 0;
  const canSave = isEdit ? dirty : true;
  const busy = save.isPending || del.isPending;

  const requestClose = () => {
    if (busy) return;
    if (dirty && !window.confirm('Discard your changes?')) return;
    onClose();
  };

  const onSubmit = (data) => {
    setServerError(null);
    const payload = isEdit ? diffItem(data, base) : formToItemPayload(data);
    if (isEdit && Object.keys(payload).length === 0) {
      onClose();
      return;
    }
    save.mutate(
      { id: item?.id, payload },
      {
        onSuccess: (saved) => {
          toast.success(isEdit ? 'Item saved.' : `${saved.name} added.`);
          onClose();
        },
        onError: (err) => {
          const d = describeError(err);
          if (d.code === 'ITEM_NAME_TAKEN') {
            setError('name', { message: 'An item with this name already exists in that category.' });
          } else {
            setServerError(d);
          }
        },
      },
    );
  };

  const footer = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        {isEdit && (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            disabled={busy}
            className={dangerButton}
          >
            Delete item
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={requestClose} disabled={busy} className={secondaryButton}>
          Cancel
        </button>
        <button type="submit" form="item-form" disabled={busy || !canSave} className={primaryButton}>
          {save.isPending && <Spinner className="h-4 w-4" />}
          {save.isPending ? 'Saving...' : isEdit ? 'Save changes' : 'Add item'}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <Modal
        title={isEdit ? 'Edit item' : 'Add item'}
        description={isEdit ? item.name : 'It shows on the menu once it is saved and available.'}
        onClose={requestClose}
        footer={footer}
      >
        <form id="item-form" noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {serverError && (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-xl bg-red-50 p-4 text-sm text-red-800 ring-1 ring-red-200"
            >
              <TriangleAlert size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
              <p>{serverError.message}</p>
            </div>
          )}

          <Field label="Name" error={errors.name?.message}>
            {(p) => (
              <input {...p} type="text" autoComplete="off" className={inputClass} {...register('name')} />
            )}
          </Field>

          <Field label="Category" error={errors.categoryId?.message}>
            {(p) => (
              <select {...p} className={inputClass} {...register('categoryId')}>
                {groups.map((g) => (
                  <optgroup key={g.name} label={g.name}>
                    {g.categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            )}
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label={`Price (\u20B9)`} error={errors.price?.message}>
              {(p) => (
                <input {...p} type="text" inputMode="decimal" className={inputClass} {...register('price')} />
              )}
            </Field>
            <Field label="GST (%)" error={errors.gstPercent?.message}>
              {(p) => (
                <input
                  {...p}
                  type="text"
                  inputMode="decimal"
                  className={inputClass}
                  {...register('gstPercent')}
                />
              )}
            </Field>
            <Field label="Prep time (min)" error={errors.prepTimeMinutes?.message}>
              {(p) => (
                <input
                  {...p}
                  type="text"
                  inputMode="numeric"
                  className={inputClass}
                  {...register('prepTimeMinutes')}
                />
              )}
            </Field>
          </div>

          <fieldset>
            <legend className="mb-1.5 text-sm font-semibold text-stone-800">Diet</legend>
            <div className="flex flex-wrap gap-3">
              {[
                ['veg', 'Vegetarian'],
                ['nonveg', 'Non-vegetarian'],
              ].map(([value, label]) => (
                <label
                  key={value}
                  className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-3 text-sm font-medium text-stone-800 ring-1 ring-stone-300 hover:bg-stone-50 has-checked:ring-2 has-checked:ring-brand-600"
                >
                  <input type="radio" value={value} className={checkboxClass} {...register('isVeg')} />
                  {label}
                </label>
              ))}
            </div>
            {errors.isVeg && (
              <p role="alert" className="mt-1.5 text-sm font-medium text-red-700">
                {errors.isVeg.message}
              </p>
            )}
          </fieldset>

          <Field label="Badge" optional error={errors.badge?.message}>
            {(p) => (
              <select {...p} className={inputClass} {...register('badge')}>
                <option value="">No badge</option>
                {BADGES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            )}
          </Field>

          <Field
            label="Description"
            optional
            hint="Shown to customers under the item name."
            error={errors.description?.message}
          >
            {(p) => (
              <textarea {...p} rows={3} className={`${inputClass} py-2.5`} {...register('description')} />
            )}
          </Field>

          <label className="flex min-h-11 cursor-pointer items-center gap-3">
            <input type="checkbox" className={checkboxClass} {...register('isAvailable')} />
            <span className="text-sm font-semibold text-stone-800">Available to order now</span>
          </label>
        </form>
      </Modal>

      {confirmDelete && (
        <ConfirmDialog
          title="Delete this item?"
          message={`"${item.name}" will be removed from the menu.`}
          confirmLabel="Delete item"
          pending={del.isPending}
          error={deleteError}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            setDeleteError(null);
            del.mutate(item.id, {
              onSuccess: () => {
                toast.success('Item deleted.');
                onClose();
              },
              onError: (err) => setDeleteError(describeError(err).message),
            });
          }}
        />
      )}
    </>
  );
}