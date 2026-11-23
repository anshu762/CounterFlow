import { useEffect, useId, useRef, useState } from 'react';
import { ImagePlus, Trash2, TriangleAlert, UtensilsCrossed } from 'lucide-react';
import Spinner from '../ui/Spinner';
import { primaryButton, secondaryButton } from '../settings/styles';
import { useUploadItemImage } from '../../hooks/useItemMutations';
import { describeError } from '../../lib/errors';
import {
  IMAGE_ACCEPT,
  formatBytes,
  imageContentType,
  uploadErrorMessage,
  validateImageFile,
} from '../../lib/imageFile';

const removeButton =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold text-red-700 ring-1 ring-red-300 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50';

// Saves immediately (it does not wait for "Save changes"). `item` is the live item from the cache.
export default function ItemPhoto({ item, removing, onRemove }) {
  const headingId = useId();
  const inputRef = useRef(null);
  const chooseRef = useRef(null);
  const upload = useUploadItemImage();
  const [picked, setPicked] = useState(null); // { file, url, contentType } waiting to be uploaded
  const [problem, setProblem] = useState(null);

  // Free the preview's memory whenever it is replaced, and when the dialog closes.
  useEffect(
    () => () => {
      if (picked) URL.revokeObjectURL(picked.url);
    },
    [picked],
  );

  const onFileChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // lets the same file be chosen again later
    if (!file) return;
    const message = validateImageFile(file);
    if (message) {
      setPicked(null);
      setProblem(message);
      return;
    }
    upload.reset();
    setProblem(null);
    setPicked({ file, url: URL.createObjectURL(file), contentType: imageContentType(file) });
  };

  const cancelPick = () => {
    setPicked(null);
    setProblem(null);
    requestAnimationFrame(() => chooseRef.current?.focus());
  };

  const send = () => {
    setProblem(null);
    upload.mutate(
      { id: item.id, file: picked.file, contentType: picked.contentType },
      {
        onSuccess: () => {
          setPicked(null);
          requestAnimationFrame(() => chooseRef.current?.focus());
        },
        onError: (err) => {
          const d = describeError(err);
          setProblem(uploadErrorMessage(d.code, d.message));
        },
      },
    );
  };

  const shown = picked?.url ?? item.imageUrl;
  let status = 'No photo yet.';
  if (picked) status = `${picked.file.name} (${formatBytes(picked.file.size)}). Not uploaded yet.`;
  else if (item.hasOwnImage) status = 'This is your own photo.';
  else if (item.imageUrl) {
    status = `Stock photo${item.imageCredit ? ` (${item.imageCredit})` : ''}. Uploading yours replaces it.`;
  }

  return (
    <section aria-labelledby={headingId} className="border-b border-stone-200 pb-6">
      <h3 id={headingId} className="text-sm font-semibold text-stone-800">
        Photo
      </h3>
      <div className="mt-2 flex flex-col gap-4 sm:flex-row">
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-brand-50 ring-1 ring-stone-200 sm:w-56 sm:shrink-0">
          {shown ? (
            <img
              src={shown}
              alt={picked ? 'Preview of the new photo' : `Photo of ${item.name}`}
              className="h-full w-full object-cover"
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
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <p className="text-sm text-stone-700 [overflow-wrap:anywhere]">{status}</p>
          <p className="text-xs text-stone-600">JPG, PNG or WebP, up to 10 MB. Saved straight away.</p>
          <input
            ref={inputRef}
            type="file"
            accept={IMAGE_ACCEPT}
            onChange={onFileChange}
            className="hidden"
            tabIndex={-1}
          />
          <div className="flex flex-wrap gap-3">
            {picked ? (
              <>
                <button
                  type="button"
                  onClick={send}
                  disabled={upload.isPending}
                  className={primaryButton}
                >
                  {upload.isPending && <Spinner className="h-4 w-4" />}
                  {upload.isPending ? 'Uploading...' : 'Upload this photo'}
                </button>
                <button
                  type="button"
                  onClick={cancelPick}
                  disabled={upload.isPending}
                  className={secondaryButton}
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  ref={chooseRef}
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  disabled={removing}
                  className={`${secondaryButton} gap-2`}
                >
                  <ImagePlus size={18} aria-hidden="true" />
                  {item.imageUrl ? 'Replace photo' : 'Choose photo'}
                </button>
                {item.hasOwnImage && (
                  <button type="button" onClick={onRemove} disabled={removing} className={removeButton}>
                    <Trash2 size={18} aria-hidden="true" />
                    Remove photo
                  </button>
                )}
              </>
            )}
          </div>
          {problem && (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-xl bg-red-50 p-3 text-sm text-red-800 ring-1 ring-red-200"
            >
              <TriangleAlert size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
              <p>{problem}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}