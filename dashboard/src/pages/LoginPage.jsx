import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Coffee, Eye, EyeOff } from 'lucide-react';
import FullScreenLoader from '../components/ui/FullScreenLoader';
import Spinner from '../components/ui/Spinner';
import { useCafe } from '../hooks/useCafe';
import { describeError } from '../lib/errors';
import { login, useSession } from '../lib/session';

const schema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Enter your email address')
    .pipe(z.email('Enter a valid email address')),
  password: z.string().min(1, 'Enter your password'),
});

// Only same-site paths are allowed as a post-login destination.
function destination(from) {
  return typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') ? from : '/';
}

function Field({ id, label, error, children }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-stone-800">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

const inputClass =
  'h-12 w-full rounded-xl border border-stone-300 bg-white px-4 text-base text-stone-900 placeholder:text-stone-400 focus:border-brand-500';

export default function LoginPage() {
  const status = useSession((s) => s.status);
  const notice = useSession((s) => s.notice);
  const location = useLocation();
  const { data: cafe } = useCafe();
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState(null);

  const {
    register,
    handleSubmit,
    setValue,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await login(values);
      // On success the session becomes "authed" and this page redirects below.
    } catch (err) {
      const info = describeError(err);
      setFormError(info.message);
      if (info.code === 'INVALID_CREDENTIALS') {
        setValue('password', '');
        setFocus('password');
      }
    }
  });

  if (status === 'booting') return <FullScreenLoader label="Checking your session..." />;
  if (status === 'authed') return <Navigate to={destination(location.state?.from)} replace />;

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-gold-200/50 blur-3xl"
        animate={{ x: [0, 40, 0], y: [0, 30, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-brand-100/70 blur-3xl"
        animate={{ x: [0, -40, 0], y: [0, -30, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />

      <motion.main
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative w-full max-w-md"
      >
        <header className="mb-6 text-center">
          <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/30 ring-4 ring-gold-200">
            <Coffee size={32} aria-hidden="true" />
          </span>
          <h1 className="text-3xl font-bold tracking-tight">
            Counter<span className="text-brand-600">Flow</span>
          </h1>
          <div className="mx-auto mt-3 flex w-40 items-center gap-2" aria-hidden="true">
            <span className="h-px flex-1 bg-gold-400" />
            <span className="h-2 w-2 rotate-45 bg-gold-500" />
            <span className="h-px flex-1 bg-gold-400" />
          </div>
          <p className="mt-3 text-stone-600">{cafe?.name ?? 'Staff sign in'}</p>
        </header>

        <form
          onSubmit={onSubmit}
          noValidate
          className="space-y-5 rounded-2xl bg-white/90 p-6 shadow-sm ring-1 ring-stone-200 backdrop-blur sm:p-8"
        >
          <h2 className="text-xl font-semibold">Sign in</h2>

          {notice && !formError && (
            <p
              role="status"
              className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200"
            >
              {notice}
            </p>
          )}
          {formError && (
            <p
              role="alert"
              className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200"
            >
              {formError}
            </p>
          )}

          <Field id="email" label="Email" error={errors.email?.message}>
            <input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="username"
              placeholder="you@example.com"
              aria-invalid={errors.email ? 'true' : 'false'}
              aria-describedby={errors.email ? 'email-error' : undefined}
              className={inputClass}
              {...register('email')}
            />
          </Field>

          <Field id="password" label="Password" error={errors.password?.message}>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                aria-invalid={errors.password ? 'true' : 'false'}
                aria-describedby={errors.password ? 'password-error' : undefined}
                className={`${inputClass} pr-14`}
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-lg text-stone-600 hover:bg-stone-100"
              >
                {showPassword ? (
                  <EyeOff size={20} aria-hidden="true" />
                ) : (
                  <Eye size={20} aria-hidden="true" />
                )}
              </button>
            </div>
          </Field>

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting && <Spinner />}
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </button>
          {isSubmitting && (
            <p className="text-center text-xs text-stone-500">
              The first sign-in after a quiet period can take a few seconds.
            </p>
          )}
        </form>
      </motion.main>
    </div>
  );
}