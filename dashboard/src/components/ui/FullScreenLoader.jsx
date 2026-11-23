import Spinner from './Spinner';

export default function FullScreenLoader({ label = 'Loading...' }) {
  return (
    <div
      role="status"
      className="flex min-h-screen flex-col items-center justify-center gap-3 text-brand-600"
    >
      <Spinner className="h-9 w-9" />
      <p className="text-sm font-medium text-stone-600">{label}</p>
    </div>
  );
}