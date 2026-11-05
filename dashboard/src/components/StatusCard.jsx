import { motion } from 'framer-motion';

// Full class names (not built dynamically) so Tailwind can detect them.
const STATES = {
  ok: {
    label: 'Operational',
    dot: 'bg-emerald-500',
    pulse: 'bg-emerald-400',
    badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  },
  degraded: {
    label: 'Degraded',
    dot: 'bg-amber-500',
    pulse: 'bg-amber-400',
    badge: 'bg-amber-50 text-amber-800 ring-amber-200',
  },
  error: {
    label: 'Unreachable',
    dot: 'bg-red-500',
    pulse: 'bg-red-400',
    badge: 'bg-red-50 text-red-700 ring-red-200',
  },
  loading: {
    label: 'Checking…',
    dot: 'bg-stone-400',
    pulse: 'bg-stone-300',
    badge: 'bg-stone-100 text-stone-600 ring-stone-200',
  },
};

export function StatusDot({ state }) {
  const s = STATES[state];
  return (
    <span className="relative flex h-3 w-3" aria-hidden="true">
      {state !== 'loading' && (
        <motion.span
          className={`absolute inline-flex h-full w-full rounded-full ${s.pulse}`}
          animate={{ scale: [1, 2.4], opacity: [0.7, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
        />
      )}
      <span className={`relative inline-flex h-3 w-3 rounded-full ${s.dot}`} />
    </span>
  );
}

export default function StatusCard({ title, icon: Icon, state, rows = [], note, index = 0 }) {
  const s = STATES[state];
  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.15 * index, ease: 'easeOut' }}
      whileHover={{ y: -4 }}
      className="rounded-2xl bg-white/90 p-6 shadow-sm ring-1 ring-stone-200 backdrop-blur"
      aria-label={`${title} status`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <Icon size={22} aria-hidden="true" />
          </span>
          <h2 className="text-lg font-semibold">{title}</h2>
        </div>
        <span
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ring-1 ${s.badge}`}
          role="status"
        >
          <StatusDot state={state} />
          {s.label}
        </span>
      </div>

      <div className="mt-5 space-y-3">
        {state === 'loading' ? (
          // Skeleton rows while loading
          [0, 1, 2].map((i) => (
            <div key={i} className="h-5 animate-pulse rounded bg-stone-100" />
          ))
        ) : (
          <dl className="space-y-2">
            {rows.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 text-sm">
                <dt className="text-stone-500">{label}</dt>
                <dd className="break-all text-right font-medium text-stone-800">{value}</dd>
              </div>
            ))}
          </dl>
        )}
        {note && state !== 'loading' && <p className="pt-1 text-sm text-stone-500">{note}</p>}
      </div>
    </motion.section>
  );
}