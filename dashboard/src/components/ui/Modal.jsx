import { useEffect, useId, useRef } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';

const WIDTH = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-2xl' };

// Counts open dialogs so page scrolling is locked until the last one closes.
let openDialogs = 0;

export default function Modal({ title, description, onClose, footer, size = 'md', children }) {
  const ref = useRef(null);
  const pressedOnBackdrop = useRef(false);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    openDialogs += 1;
    document.body.style.overflow = 'hidden';
    if (!dialog.open) dialog.showModal();
    return () => {
      openDialogs -= 1;
      if (openDialogs === 0) document.body.style.overflow = '';
      if (dialog.open) dialog.close();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onMouseDown={(e) => {
        pressedOnBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (pressedOnBackdrop.current && e.target === e.currentTarget) onClose();
      }}
      className={`m-auto w-[calc(100%-1.5rem)] ${WIDTH[size]} overflow-hidden rounded-2xl bg-white p-0 text-stone-900 shadow-2xl backdrop:bg-stone-900/50`}
    >
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="flex max-h-[90dvh] flex-col"
      >
        <div className="flex items-start justify-between gap-4 border-b border-stone-200 px-5 py-3">
          <div className="min-w-0 py-1">
            <h2 id={titleId} className="text-lg font-semibold">
              {title}
            </h2>
            {description && <p className="mt-0.5 truncate text-sm text-stone-600">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-stone-700 hover:bg-stone-100"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-5">{children}</div>
        {footer && <div className="border-t border-stone-200 bg-stone-50 px-5 py-4">{footer}</div>}
      </motion.div>
    </dialog>
  );
}