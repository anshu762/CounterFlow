import { Controller, useWatch } from 'react-hook-form';
import { Check } from 'lucide-react';
import Field from './Field';
import { checkboxClass, inputClass } from './styles';
import { themeFromForm } from '../../lib/settingsForm';
import { THEMES, isHexColour, resolveTheme } from '../../theme/themes';

function ColourField({ control, name, label, hint, error }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Field label={label} hint={hint} error={error}>
          {(props) => (
            <div className="flex items-center gap-2">
              <input
                type="color"
                aria-label={`${label} picker`}
                value={isHexColour(field.value) ? field.value.toLowerCase() : '#000000'}
                onChange={(e) => field.onChange(e.target.value)}
                className="h-11 w-11 shrink-0 cursor-pointer rounded-lg border-0 bg-transparent p-0.5 ring-1 ring-stone-300 disabled:cursor-not-allowed"
              />
              <input
                {...props}
                type="text"
                value={field.value}
                onChange={(e) => field.onChange(e.target.value)}
                onBlur={field.onBlur}
                ref={field.ref}
                maxLength={7}
                spellCheck={false}
                autoComplete="off"
                className={`${inputClass} font-mono uppercase`}
              />
            </div>
          )}
        </Field>
      )}
    />
  );
}

export default function ThemePicker({ control, register, setValue, errors }) {
  const [themeId, customOn, brand, accent, paper] = useWatch({
    control,
    name: ['themeId', 'customOn', 'brand', 'accent', 'paper'],
  });
  const resolved = resolveTheme(themeFromForm({ themeId, customOn, brand, accent, paper }));

  // Picking a preset resets the colour fields to that preset and turns custom colours off.
  const choosePreset = (id) => {
    const t = THEMES[id];
    setValue('customOn', false, { shouldDirty: true });
    setValue('brand', t.brand, { shouldDirty: true });
    setValue('accent', t.accent, { shouldDirty: true });
    setValue('paper', t.paper, { shouldDirty: true });
  };

  return (
    <div>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-stone-800">Colour theme</legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Object.entries(THEMES).map(([id, t]) => (
            <label key={id} className="relative block cursor-pointer">
              <input
                type="radio"
                value={id}
                className="peer sr-only"
                {...register('themeId', { onChange: (e) => choosePreset(e.target.value) })}
              />
              <span className="flex min-h-11 items-center gap-3 rounded-xl bg-white p-3 ring-1 ring-stone-300 transition hover:bg-stone-50 peer-checked:ring-2 peer-checked:ring-brand-600 peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-600 peer-disabled:cursor-not-allowed peer-disabled:opacity-70 [&_.tick]:opacity-0 peer-checked:[&_.tick]:opacity-100">
                <span className="flex shrink-0 -space-x-1.5" aria-hidden="true">
                  {[t.brand, t.accent, t.paper].map((c) => (
                    <span
                      key={c}
                      style={{ backgroundColor: c }}
                      className="h-6 w-6 rounded-full shadow-sm ring-2 ring-white"
                    />
                  ))}
                </span>
                <span className="text-sm font-semibold text-stone-800">{t.name}</span>
                <Check size={18} aria-hidden="true" className="tick ml-auto text-brand-700 transition-opacity" />
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-6 rounded-xl bg-stone-50 p-4 ring-1 ring-stone-200">
        <label className="flex min-h-11 cursor-pointer items-center gap-3">
          <input type="checkbox" className={checkboxClass} {...register('customOn')} />
          <span className="text-sm font-semibold text-stone-800">Use custom colours</span>
        </label>
        {customOn && (
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <ColourField
              control={control}
              name="brand"
              label="Main colour"
              hint="Buttons and highlights."
              error={errors.brand?.message}
            />
            <ColourField
              control={control}
              name="accent"
              label="Accent colour"
              hint="Small decorative touches."
              error={errors.accent?.message}
            />
            <ColourField
              control={control}
              name="paper"
              label="Page background"
              hint="Keep it light."
              error={errors.paper?.message}
            />
          </div>
        )}
      </div>

      <div
        aria-hidden="true"
        className="mt-6 overflow-hidden rounded-xl ring-1 ring-stone-200"
        style={{ backgroundColor: resolved.paper }}
      >
        <div className="flex items-center justify-between px-4 py-3 text-white" style={{ backgroundColor: resolved.brand }}>
          <span className="font-display text-base font-bold">Brick House Kitchen</span>
          <span className="text-xs font-medium opacity-90">Preview</span>
        </div>
        <div className="flex flex-wrap items-center gap-3 p-4">
          <span
            className="inline-flex min-h-11 items-center rounded-xl px-5 text-sm font-semibold text-white"
            style={{ backgroundColor: resolved.brand }}
          >
            Place order
          </span>
          <span
            className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold text-stone-800 ring-2"
            style={{ '--tw-ring-color': resolved.accent }}
          >
            House special
          </span>
          <span className="text-sm text-stone-700">Sample text on your page background.</span>
        </div>
      </div>
      <p className="mt-2 text-sm text-stone-600">
        The whole dashboard shows your choice right away. It is only saved when you press Save changes.
      </p>
    </div>
  );
}