import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Lock, TriangleAlert } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import ErrorState from '../components/ui/ErrorState';
import Spinner from '../components/ui/Spinner';
import Field from '../components/settings/Field';
import Section from '../components/settings/Section';
import ThemePicker from '../components/settings/ThemePicker';
import HoursEditor from '../components/settings/HoursEditor';
import AcceptingOrdersCard from '../components/settings/AcceptingOrdersCard';
import {
  checkboxClass,
  inputClass,
  primaryButton,
  secondaryButton,
} from '../components/settings/styles';
import { useSettings } from '../hooks/useSettings';
import { api } from '../lib/api';
import { describeError } from '../lib/errors';
import { useSession } from '../lib/session';
import { toast } from '../lib/toast';
import {
  cafeFromSettings,
  diffPayload,
  settingsFormSchema,
  settingsToForm,
  themeFromForm,
} from '../lib/settingsForm';
import { applyTheme } from '../theme/applyTheme';

const SUBTITLE = 'Café details, billing, opening hours and theme.';

function SettingsSkeleton() {
  return (
    <div role="status" className="space-y-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-40 animate-pulse rounded-2xl bg-white ring-1 ring-stone-200" />
      ))}
      <span className="sr-only">Loading settings</span>
    </div>
  );
}

function SettingsForm({ settings, canEdit }) {
  const qc = useQueryClient();
  const [base, setBase] = useState(() => settingsToForm(settings));
  const [serverError, setServerError] = useState(null);

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    getValues,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: base,
    mode: 'onTouched',
  });

  const values = useWatch({ control });
  const hasChanges = Object.keys(diffPayload(values, base)).length > 0;

  const save = useMutation({
    mutationFn: async (payload) => (await api.patch('/api/settings', payload)).data,
    onSuccess: (data, payload) => {
      const current = qc.getQueryData(['settings']) ?? settings;
      const saved = data?.settings ?? { ...current, ...payload };
      qc.setQueryData(['settings'], saved);
      // Write the public copy directly: /api/cafe is cached for 10 s, so refetching could return old data.
      qc.setQueryData(['cafe'], (old) => (old ? { ...old, ...cafeFromSettings(saved) } : old));
      const next = settingsToForm(saved);
      setBase(next);
      reset(next);
      setServerError(null);
      toast.success('Settings saved.');
    },
    onError: (err) => setServerError(describeError(err)),
  });

  const onSubmit = (data) => {
    if (!canEdit) return;
    const payload = diffPayload(data, base);
    if (Object.keys(payload).length === 0) return;
    setServerError(null);
    save.mutate(payload);
  };
  const onInvalid = () => toast.error('Please fix the highlighted fields.');

  const discard = () => {
    reset(base);
    setServerError(null);
  };

  // Live preview: the whole dashboard shows the theme being edited.
  const { themeId, customOn, brand, accent, paper } = values;
  useEffect(() => {
    if (!canEdit) return;
    applyTheme(themeFromForm({ themeId, customOn, brand, accent, paper }));
  }, [canEdit, themeId, customOn, brand, accent, paper]);

  // Leaving the page drops any unsaved preview and restores the saved theme.
  useEffect(
    () => () => applyTheme(qc.getQueryData(['cafe'])?.theme ?? null),
    [qc],
  );

  // Browser warning when closing or reloading with unsaved edits.
  useEffect(() => {
    if (!canEdit || !hasChanges) return undefined;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [canEdit, hasChanges]);

  const actionBar = canEdit ? (
    <div className="flex flex-wrap items-center gap-3">
      {hasChanges && <span className="text-sm font-medium text-amber-800">Unsaved changes</span>}
      <button
        type="button"
        onClick={discard}
        disabled={!hasChanges || save.isPending}
        className={secondaryButton}
      >
        Reset
      </button>
      <button
        type="submit"
        form="settings-form"
        disabled={!hasChanges || save.isPending}
        className={primaryButton}
      >
        {save.isPending && <Spinner className="h-4 w-4" />}
        {save.isPending ? 'Saving...' : 'Save changes'}
      </button>
    </div>
  ) : null;

  return (
    <>
      <PageHeader title="Settings" subtitle={SUBTITLE} actions={actionBar} />

      <div className="mb-4 lg:mb-6">
        <AcceptingOrdersCard />
      </div>

      <form
        id="settings-form"
        noValidate
        onSubmit={handleSubmit(onSubmit, onInvalid)}
        className="space-y-4 lg:space-y-6"
      >
        {!canEdit && (
          <div className="flex items-start gap-3 rounded-xl bg-stone-100 p-4 text-sm text-stone-800 ring-1 ring-stone-200">
            <Lock size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
            <p>You can view these settings. Only the owner can change them.</p>
          </div>
        )}

        {serverError && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl bg-red-50 p-4 text-sm text-red-800 ring-1 ring-red-200"
          >
            <TriangleAlert size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
            <p>{serverError.message}</p>
          </div>
        )}

        <fieldset disabled={!canEdit} className="min-w-0 space-y-4 border-0 p-0 lg:space-y-6">
          <Section
            index={0}
            title="Café details"
            description="These details appear in the customer app and on bills."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field className="sm:col-span-2" label="Café name" error={errors.name?.message}>
                {(p) => (
                  <input
                    {...p}
                    type="text"
                    autoComplete="organization"
                    className={inputClass}
                    {...register('name')}
                  />
                )}
              </Field>
              <Field label="Phone" optional error={errors.phone?.message}>
                {(p) => (
                  <input
                    {...p}
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    className={inputClass}
                    {...register('phone')}
                  />
                )}
              </Field>
              <Field label="Email" optional error={errors.email?.message}>
                {(p) => (
                  <input
                    {...p}
                    type="email"
                    autoComplete="email"
                    className={inputClass}
                    {...register('email')}
                  />
                )}
              </Field>
              <Field
                className="sm:col-span-2"
                label="Address"
                optional
                error={errors.address?.message}
              >
                {(p) => (
                  <textarea
                    {...p}
                    rows={2}
                    autoComplete="street-address"
                    className={`${inputClass} py-2.5`}
                    {...register('address')}
                  />
                )}
              </Field>
              <Field label="City" optional error={errors.city?.message}>
                {(p) => <input {...p} type="text" className={inputClass} {...register('city')} />}
              </Field>
              <Field label="State" optional error={errors.state?.message}>
                {(p) => <input {...p} type="text" className={inputClass} {...register('state')} />}
              </Field>
              <Field
                label="GSTIN"
                optional
                hint="15 characters, for example 27ABCDE1234F1Z5."
                error={errors.gstin?.message}
              >
                {(p) => (
                  <input
                    {...p}
                    type="text"
                    spellCheck={false}
                    autoComplete="off"
                    className={`${inputClass} uppercase`}
                    {...register('gstin')}
                  />
                )}
              </Field>
              <Field
                label="Logo link"
                optional
                hint="A link starting with https://"
                error={errors.logoUrl?.message}
              >
                {(p) => (
                  <input
                    {...p}
                    type="url"
                    inputMode="url"
                    spellCheck={false}
                    className={inputClass}
                    {...register('logoUrl')}
                  />
                )}
              </Field>
            </div>
          </Section>

          <div className="grid items-start gap-4 lg:grid-cols-2 lg:gap-6">
            <Section index={1} title="Billing and orders" description="Used when a bill and wait time are worked out.">
              <div className="space-y-4">
                <Field
                  label="Default GST (%)"
                  hint="Between 0 and 28."
                  error={errors.defaultGstPercent?.message}
                >
                  {(p) => (
                    <input
                      {...p}
                      type="text"
                      inputMode="decimal"
                      className={inputClass}
                      {...register('defaultGstPercent')}
                    />
                  )}
                </Field>
                <label className="flex min-h-11 cursor-pointer items-start gap-3">
                  <input type="checkbox" className={`${checkboxClass} mt-0.5`} {...register('pricesIncludeGst')} />
                  <span className="text-sm text-stone-800">
                    <span className="font-semibold">Menu prices already include GST</span>
                    <span className="block text-stone-600">
                      Leave this off if GST is added on top at billing.
                    </span>
                  </span>
                </label>
                <Field
                  label="Bill prefix"
                  hint="1 to 6 letters or numbers, shown at the start of bill numbers."
                  error={errors.billPrefix?.message}
                >
                  {(p) => (
                    <input
                      {...p}
                      type="text"
                      maxLength={6}
                      autoComplete="off"
                      className={`${inputClass} uppercase`}
                      {...register('billPrefix')}
                    />
                  )}
                </Field>
                <Field
                  label="Minutes per order in the queue"
                  hint="Added to the wait time for each order ahead of a new one."
                  error={errors.avgPrepSlotMinutes?.message}
                >
                  {(p) => (
                    <input
                      {...p}
                      type="text"
                      inputMode="numeric"
                      className={inputClass}
                      {...register('avgPrepSlotMinutes')}
                    />
                  )}
                </Field>
              </div>
            </Section>

            <Section index={2} title="Opening hours" description="Use 24-hour times. Tick Closed for days off.">
              <HoursEditor
                control={control}
                register={register}
                setValue={setValue}
                getValues={getValues}
                errors={errors}
              />
            </Section>
          </div>

          <Section index={3} title="Theme" description="Choose the colours used across the dashboard.">
            <ThemePicker control={control} register={register} setValue={setValue} errors={errors} />
          </Section>
        </fieldset>

        {canEdit && <div className="flex justify-end pb-2">{actionBar}</div>}
      </form>
    </>
  );
}

export default function SettingsPage() {
  const canEdit = useSession((s) => s.role) === 'owner';
  // Always load fresh values when the page opens, and never refetch under an open form.
  const q = useSettings({ refetchOnMount: 'always', refetchOnReconnect: false });

  if (q.isPending || q.isFetching) {
    return (
      <>
        <PageHeader title="Settings" subtitle={SUBTITLE} />
        <SettingsSkeleton />
      </>
    );
  }

  if (!q.data) {
    return (
      <>
        <PageHeader title="Settings" subtitle={SUBTITLE} />
        <ErrorState
          title="Could not load settings"
          message={describeError(q.error).message}
          onRetry={() => q.refetch()}
        />
      </>
    );
  }

  return <SettingsForm settings={q.data} canEdit={canEdit} />;
}