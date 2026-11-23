export default function EmptyState({ icon: Icon, title, message, action }) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-14 text-center">
      {Icon && (
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gold-100 text-brand-600">
          <Icon size={26} aria-hidden="true" />
        </span>
      )}
      <h2 className="text-lg font-semibold">{title}</h2>
      {message && <p className="max-w-md text-sm text-stone-600">{message}</p>}
      {action}
    </div>
  );
}