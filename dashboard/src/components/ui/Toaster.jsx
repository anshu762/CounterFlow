import { AnimatePresence, motion } from 'framer-motion';
import { Check, Info, TriangleAlert, X } from 'lucide-react';
import { dismissToast, useToasts } from '../../lib/toast';

const KINDS = {
  success: { icon: Check, accent: 'border-emerald-600', iconClass: 'text-emerald-700' },
  error: { icon: TriangleAlert, accent: 'border-red-600', iconClass: 'text-red-700' },
  info: { icon: Info, accent: 'border-brand-600', iconClass: 'text-brand-700' },
};

export default function Toaster() {
  const items = useToasts((s) => s.items);
  return (
    <ul className="pointer-events-none fixed inset-x-4 bottom-20 z-[60] flex flex-col items-center gap-2 md:inset-x-auto md:bottom-6 md:right-6 md:items-end">
      <AnimatePresence initial={false}>
        {items.map((t) => {
          const k = KINDS[t.kind] ?? KINDS.info;
          const Icon = k.icon;
          return (
            <motion.li
              key={t.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              role={t.kind === 'error' ? 'alert' : 'status'}
              className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border-l-4 bg-white py-3 pl-3 pr-1 shadow-lg ring-1 ring-stone-200 ${k.accent}`}
            >
              <Icon size={20} aria-hidden="true" className={`mt-0.5 shrink-0 ${k.iconClass}`} />
              <p className="flex-1 text-sm text-stone-800">{t.message}</p>
              <button
                type="button"
                onClick={() => dismissToast(t.id)}
                aria-label="Dismiss notification"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ul>
  );
}