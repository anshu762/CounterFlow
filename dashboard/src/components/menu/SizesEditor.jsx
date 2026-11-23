import { useEffect, useId, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Pencil, Plus, Trash2, TriangleAlert } from 'lucide-react';
import Field from '../settings/Field';
import Spinner from '../ui/Spinner';
import Switch from '../ui/Switch';
import { dangerButton } from '../ui/buttons';
import { inputClass, primaryButton, secondaryButton } from '../settings/styles';
import {
  useCreateVariant,
  useDeleteVariant,
  useSetVariantAvailability,
  useUpdateVariant,
} from '../../hooks/useItemMutations';
import { describeError } from '../../lib/errors';
import { formatPrice } from '../../lib/format';
import {
  diffVariant,
  formToVariantPayload,
  variantFormSchema,
  variantToForm,
} from '../../lib/variantForm';

// Add (variant = null) or edit one size. Has its own <form>, separate from the item form.
function SizeForm({ itemId, variant, onDone }) {
  const isEdit = Boolean(variant);
  const [base] = useState(() => variantToForm(variant));
  const [serverError, setServerError] = useState(null);
  const create = useCreateVariant();
  const update = useUpdateVariant();
  const pending = create.isPending || update.isPending;

  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(variantFormSchema),
    defaultValues: base,
    mode: 'onTouched',
  });

  useEffect(() => {
    setFocus('label');
  }, [setFocus]);

  const onSubmit = (data) => {
    setServerError(null);
    const handlers = {
      onSuccess: onDone,
      onError: (err) => {
        const d = describeError(err);
        if (d.code === 'VARIANT_LABEL_TAKEN') {
          setError('label', { message: 'This item already has a size with that name.' });
        } else {
          setServerError(d.message);
        }
      },
    };
    if (isEdit) {
      const payload = diffVariant(data, base);
      if (Object.keys(payload).length === 0) {
        onDone();
      } else {
        update.mutate({ itemId, variantId: variant.id, payload }, handlers);
      }
    } else {
      create.mutate({ itemId, payload: formToVariantPayload(data) }, handlers);
    }
  };

  return (
    <form
      noValidate
      onSubmit={handleSubmit(onSubmit)}
      className="rounded-xl bg-stone-50 p-4 ring-1 ring-stone-200"
    >
      {serverError && (
        <div
          role="alert"
          className="mb-3 flex items-start gap-3 rounded-xl bg-red-50 p-3 text-sm text-red-800 ring-1 ring-red-200"
        >
          <TriangleAlert size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
          <p>{serverError}</p>
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Size name" error={errors.label?.message}>
          {(p) => (
            <input
              {...p}
              type="text"
              autoComplete="off"
              placeholder="Large"
              className={inputClass}
              {...register('label')}
            />
          )}
        </Field>
        <Field label={`Price (\u20B9)`} error={errors.price?.message}>
          {(p) => (
            <input
              {...p}
              type="text"
              inputMode="decimal"
              className={inputClass}
              {...register('price')}
            />
          )}
        </Field>
      </div>
      <div className="mt-4 flex flex-wrap justify-end gap-3">
        <button type="button" onClick={onDone} disabled={pending} className={secondaryButton}>
          Cancel
        </button>
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending && <Spinner className="h-4 w-4" />}
          {pending ? 'Saving...' : isEdit ? 'Save size' : 'Add size'}
        </button>
      </div>
    </form>
  );
}

function SizeRow({ itemId, variant, onEdit }) {
  const availability = useSetVariantAvailability();
  const del = useDeleteVariant();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState(null);
  const keepRef = useRef(null);

  useEffect(() => {
    if (confirming) keepRef.current?.focus();
  }, [confirming]);

  return (
    <div className="rounded-xl bg-white p-3 ring-1 ring-stone-200">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-stone-900">{variant.label}</p>
          <p className="text-sm text-stone-700">
            {formatPrice(variant.price)}
            {variant.isAvailable ? '' : ' \u00B7 Unavailable'}
          </p>
        </div>
        <div className="flex items-center">
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Edit size ${variant.label}`}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-stone-700 hover:bg-stone-100"
          >
            <Pencil size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            aria-label={`Delete size ${variant.label}`}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-red-700 hover:bg-red-50"
          >
            <Trash2 size={18} aria-hidden="true" />
          </button>
          <Switch
            checked={variant.isAvailable}
            busy={availability.isPending}
            label={`${variant.label} available`}
            onChange={(isAvailable) =>
              availability.mutate({ itemId, variantId: variant.id, isAvailable })
            }
          />
        </div>
      </div>
      {confirming && (
        <div role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-900 ring-1 ring-red-200">
          <p>Delete the size &quot;{variant.label}&quot;? This cannot be undone.</p>
          {error && <p className="mt-1 font-medium">{error}</p>}
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              ref={keepRef}
              type="button"
              disabled={del.isPending}
              onClick={() => {
                setConfirming(false);
                setError(null);
              }}
              className={secondaryButton}
            >
              Keep size
            </button>
            <button
              type="button"
              disabled={del.isPending}
              onClick={() => {
                setError(null);
                del.mutate(
                  { itemId, variantId: variant.id },
                  { onError: (err) => setError(describeError(err).message) },
                );
              }}
              className={dangerButton}
            >
              {del.isPending && <Spinner className="h-4 w-4" />}
              Delete size
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Saves immediately (each size is its own request). `item` is the live item from the cache.
export default function SizesEditor({ item }) {
  const headingId = useId();
  const addRef = useRef(null);
  const [mode, setMode] = useState(null); // null | 'add' | a variant id being edited
  const variants = item.variants ?? [];

  const finish = () => {
    setMode(null);
    requestAnimationFrame(() => addRef.current?.focus());
  };

  return (
    <section aria-labelledby={headingId} className="border-t border-stone-200 pt-6">
      <div className="flex items-center justify-between gap-3">
        <h3 id={headingId} className="text-sm font-semibold text-stone-800">
          Sizes
        </h3>
        <button
          ref={addRef}
          type="button"
          onClick={() => setMode('add')}
          disabled={mode !== null}
          className="-mr-2 inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-brand-700 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size={16} aria-hidden="true" />
          Add size
        </button>
      </div>
      <p className="text-xs text-stone-600">
        Optional, for items sold in sizes such as Small, Medium and Large. Saved straight away.
      </p>
      {variants.length === 0 && mode !== 'add' && (
        <p className="mt-3 rounded-xl bg-stone-50 p-4 text-sm text-stone-600 ring-1 ring-stone-200">
          No sizes. This item is sold at one price.
        </p>
      )}
      {variants.length > 0 && (
        <ul className="mt-3 space-y-2">
          {variants.map((v) => (
            <li key={v.id}>
              {mode === v.id ? (
                <SizeForm itemId={item.id} variant={v} onDone={finish} />
              ) : (
                <SizeRow itemId={item.id} variant={v} onEdit={() => setMode(v.id)} />
              )}
            </li>
          ))}
        </ul>
      )}
      {mode === 'add' && (
        <div className="mt-3">
          <SizeForm itemId={item.id} variant={null} onDone={finish} />
        </div>
      )}
    </section>
  );
}