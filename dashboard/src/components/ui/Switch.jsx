import Spinner from './Spinner';

export default function Switch({ checked, onChange, label, disabled = false, busy = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled || busy}
      onClick={() => onChange(!checked)}
      className="inline-flex h-11 w-14 shrink-0 items-center justify-center disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          checked ? 'bg-emerald-700' : 'bg-stone-500'
        }`}
      >
        <span
          className={`flex h-5 w-5 items-center justify-center rounded-full bg-white text-stone-700 shadow transition-transform ${
            checked ? 'translate-x-[22px]' : 'translate-x-0.5'
          }`}
        >
          {busy && <Spinner className="h-3 w-3" />}
        </span>
      </span>
    </button>
  );
}