import { useWatch } from 'react-hook-form';
import { DAYS } from '../../lib/settingsForm';
import { checkboxClass, inputClass, secondaryButton } from './styles';

const ROW = 'sm:grid-cols-[7rem_1fr_1fr_6rem]';

export default function HoursEditor({ control, register, setValue, getValues, errors }) {
  const hours = useWatch({ control, name: 'hours' });

  const copyMonday = () => {
    const mon = getValues('hours.mon');
    for (const [key] of DAYS) {
      if (key === 'mon') continue;
      setValue(`hours.${key}.open`, mon.open, { shouldDirty: true });
      setValue(`hours.${key}.close`, mon.close, { shouldDirty: true });
      setValue(`hours.${key}.closed`, mon.closed, { shouldDirty: true });
    }
  };

  return (
    <div>
      <div
        aria-hidden="true"
        className={`hidden gap-3 pb-2 text-xs font-semibold uppercase tracking-wide text-stone-500 sm:grid ${ROW}`}
      >
        <span>Day</span>
        <span>Opens</span>
        <span>Closes</span>
        <span>Closed</span>
      </div>
      <ul className="divide-y divide-stone-200">
        {DAYS.map(([key, label]) => {
          const closed = Boolean(hours?.[key]?.closed);
          const rowError =
            errors.hours?.[key]?.open?.message || errors.hours?.[key]?.close?.message;
          return (
            <li key={key} className={`grid grid-cols-2 items-center gap-x-3 gap-y-2 py-3 ${ROW}`}>
              <span className="col-span-2 font-semibold text-stone-800 sm:col-span-1">{label}</span>
              <label className={`block ${closed ? 'opacity-50' : ''}`}>
                <span aria-hidden="true" className="mb-1 block text-xs font-medium text-stone-600 sm:hidden">
                  Opens
                </span>
                <input
                  type="time"
                  aria-label={`${label} opens`}
                  className={inputClass}
                  {...register(`hours.${key}.open`)}
                />
              </label>
              <label className={`block ${closed ? 'opacity-50' : ''}`}>
                <span aria-hidden="true" className="mb-1 block text-xs font-medium text-stone-600 sm:hidden">
                  Closes
                </span>
                <input
                  type="time"
                  aria-label={`${label} closes`}
                  className={inputClass}
                  {...register(`hours.${key}.close`)}
                />
              </label>
              <label className="col-span-2 flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium text-stone-800 sm:col-span-1">
                <input type="checkbox" className={checkboxClass} {...register(`hours.${key}.closed`)} />
                Closed
                <span className="sr-only"> on {label}</span>
              </label>
              {rowError && (
                <p role="alert" className="col-span-2 text-sm font-medium text-red-700 sm:col-span-4">
                  {label}: {rowError}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={copyMonday} className={secondaryButton}>
          Copy Monday to all days
        </button>
        <p className="text-sm text-stone-600">Saving after any change stores all seven days.</p>
      </div>
    </div>
  );
}