import { TriangleAlert } from 'lucide-react';

export default function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  retryLabel = 'Try again',
  onSecondary,
  secondaryLabel,
  compact = false,
}) {
  return (
    <div
      role="alert"
      className={`flex flex-col items-center text-center ${compact ? 'gap-2 py-4' : 'gap-3 py-12'}`}
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-700">
        <TriangleAlert size={24} aria-hidden="true" />
      </span>
      <h2 className="text-lg font-semibold">{title}</h2>
      {message && <p className="max-w-md text-sm text-stone-600">{message}</p>}
      <div className="mt-1 flex flex-wrap justify-center gap-2">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex min-h-11 items-center rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            {retryLabel}
          </button>
        )}
        {onSecondary && (
          <button
            type="button"
            onClick={onSecondary}
            className="inline-flex min-h-11 items-center rounded-xl px-5 text-sm font-semibold text-stone-700 ring-1 ring-stone-300 hover:bg-stone-100"
          >
            {secondaryLabel}
          </button>
        )}
      </div>
    </div>
  );
}