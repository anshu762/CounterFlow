import { useId } from 'react';

// Label + input + hint + error. `children` is a function that receives the props the input needs.
export default function Field({ label, hint, error, optional = false, className = '', children }) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-stone-800">
        {label}
        {optional && <span className="ml-1 font-normal text-stone-500">(optional)</span>}
      </label>
      {children({
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy,
      })}
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-sm font-medium text-red-700">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="mt-1.5 text-sm text-stone-600">
            {hint}
          </p>
        )
      )}
    </div>
  );
}