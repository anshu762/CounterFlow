import { useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { TriangleAlert } from 'lucide-react';
import Modal from '../ui/Modal';
import ConfirmDialog from '../ui/ConfirmDialog';
import Spinner from '../ui/Spinner';
import { dangerButton } from '../ui/buttons';
import Field from '../settings/Field';
import { checkboxClass, inputClass, primaryButton, secondaryButton } from '../settings/styles';
import { useDeleteCategory, useSaveCategory } from '../../hooks/useMenuMutations';
import { describeError } from '../../lib/errors';
import { toast } from '../../lib/toast';
import {
  categoryFormSchema,
  categoryToForm,
  diffCategory,
  formToCategoryPayload,
} from '../../lib/menuForm';

// `category` is null when adding. `defaultGroup` pre-fills the group for a new category.
export default function CategoryDialog({ category, groups, defaultGroup, onClose, onSaved }) {
  const isEdit = Boolean(category);
  const listId = useId();
  const [base] = useState(() => categoryToForm(category, { groupName: defaultGroup ?? '' }));
  const [serverError, setServerError] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const save = useSaveCategory();
  const del = useDeleteCategory();

  const {
    register,
    handleSubmit,
    setError,
    getValues,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: base,
    mode: 'onTouched',
  });

  const busy = save.isPending || del.isPending;
  const isDirty = () => Object.keys(diffCategory(getValues(), base)).length > 0;

  const requestClose = () => {
    if (busy) return;
    if (isDirty() && !window.confirm('Discard your changes?')) return;
    onClose();
  };

  const onSubmit = (data) => {
    setServerError(null);
    const payload = isEdit ? diffCategory(data, base) : formToCategoryPayload(data);
    if (isEdit && Object.keys(payload).length === 0) {
      onClose();
      return;
    }
    save.mutate(
      { id: category?.id, payload },
      {
        onSuccess: (saved) => {
          toast.success(isEdit ? 'Category saved.' : `${saved.name} added.`);
          onSaved?.(saved, !isEdit);
          onClose();
        },
        onError: (err) => {
          const d = describeError(err);
          if (d.code === 'CATEGORY_NAME_TAKEN') {
            setError('name', { message: 'A category with this name already exists.' });
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
        {isEdit &&
          (category.itemCount > 0 ? (
            <p className="max-w-xs text-sm text-stone-600">
              To delete this category, first move or delete its {category.itemCount} items. You can also hide it.
            </p>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              disabled={busy}
              className={dangerButton}
            >
              Delete category
            </button>
          ))}
      </div>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={requestClose} disabled={busy} className={secondaryButton}>
          Cancel
        </button>
        <button type="submit" form="category-form" disabled={busy} className={primaryButton}>
          {save.isPending && <Spinner className="h-4 w-4" />}
          {save.isPending ? 'Saving...' : isEdit ? 'Save changes' : 'Add category'}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <Modal
        title={isEdit ? 'Edit category' : 'Add category'}
        description={isEdit ? category.name : undefined}
        onClose={requestClose}
        footer={footer}
      >
        <form id="category-form" noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {serverError && (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-xl bg-red-50 p-4 text-sm text-red-800 ring-1 ring-red-200"
            >
              <TriangleAlert size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
              <p>{serverError.message}</p>
            </div>
          )}

          <Field
            label="Group"
            hint="Pick an existing group or type a new one."
            error={errors.groupName?.message}
          >
            {(p) => (
              <>
                <input
                  {...p}
                  type="text"
                  list={listId}
                  autoComplete="off"
                  className={inputClass}
                  {...register('groupName')}
                />
                <datalist id={listId}>
                  {groups.map((g) => (
                    <option key={g.name} value={g.name} />
                  ))}
                </datalist>
              </>
            )}
          </Field>

          <Field label="Category name" error={errors.name?.message}>
            {(p) => (
              <input {...p} type="text" autoComplete="off" className={inputClass} {...register('name')} />
            )}
          </Field>

          <Field label="Description" optional error={errors.description?.message}>
            {(p) => (
              <textarea {...p} rows={3} className={`${inputClass} py-2.5`} {...register('description')} />
            )}
          </Field>

          <label className="flex min-h-11 cursor-pointer items-start gap-3">
            <input type="checkbox" className={`${checkboxClass} mt-0.5`} {...register('isActive')} />
            <span className="text-sm text-stone-800">
              <span className="font-semibold">Visible to customers</span>
              <span className="block text-stone-600">Untick to hide the whole category from the app.</span>
            </span>
          </label>
        </form>
      </Modal>

      {confirmDelete && (
        <ConfirmDialog
          title="Delete this category?"
          message={`"${category.name}" will be removed. Only empty categories can be deleted.`}
          confirmLabel="Delete category"
          pending={del.isPending}
          error={deleteError}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            setDeleteError(null);
            del.mutate(category.id, {
              onSuccess: () => {
                toast.success('Category deleted.');
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