import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import PageHeader from '../components/ui/PageHeader';
import ErrorState from '../components/ui/ErrorState';
import Spinner from '../components/ui/Spinner';
import { StatusDot } from '../components/StatusCard';
import { useApiHealth, useDbHealth } from '../hooks/useApiStatus';
import { useSettings } from '../hooks/useSettings';
import { api } from '../lib/api';
import { describeError } from '../lib/errors';
import { useSession } from '../lib/session';
import { toast } from '../lib/toast';

const card = 'rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-200 sm:p-6';

function Card({ index, className = '', children, label }) {
  return (
    <motion.section
      aria-label={label}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 * index, ease: 'easeOut' }}
      className={`${card} ${className}`}
    >
      {children}
    </motion.section>
  );
}

function AcceptingOrdersCard({ index }) {
  const qc = useQueryClient();
  const settingsQ = useSettings();

  const mutation = useMutation({
    mutationFn: async (acceptingOrders) => {
      await api.patch('/api/settings/accepting-orders', { acceptingOrders });
      return acceptingOrders;
    },
    onSuccess: (value) => {
      qc.setQueryData(['settings'], (old) => (old ? { ...old, acceptingOrders: value } : old));
      qc.setQueryData(['cafe'], (old) => (old ? { ...old, acceptingOrders: value } : old));
      toast.success(value ? 'Now accepting orders.' : 'Orders paused. Customers cannot order.');
    },
    onError: (err) => toast.error(describeError(err).message),
  });

  const accepting = settingsQ.data?.acceptingOrders;

  return (
    <Card index={index} className="lg:col-span-2" label="Accepting orders">
      <h2 className="text-lg font-semibold">Customer orders</h2>
      {settingsQ.isPending ? (
        <div className="mt-5 space-y-3" role="status">
          <div className="h-6 w-2/3 animate-pulse rounded bg-stone-100" />
          <div className="h-11 w-24 animate-pulse rounded-full bg-stone-100" />
          <span className="sr-only">Loading</span>
        </div>
      ) : settingsQ.isError ? (
        <ErrorState
          compact
          title="Could not load settings"
          message={describeError(settingsQ.error).message}
          onRetry={() => settingsQ.refetch()}
        />
      ) : (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-stone-800">
              {accepting ? 'Accepting orders' : 'Orders paused'}
            </p>
            <p className="text-sm text-stone-600">
              {accepting
                ? 'Customers can place orders in the app.'
                : 'Customers can see the menu but cannot order.'}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={Boolean(accepting)}
            aria-label="Accepting orders"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate(!accepting)}
            className={`relative inline-flex h-11 w-[72px] shrink-0 items-center rounded-full p-1 transition-colors disabled:opacity-60 ${
              accepting ? 'justify-end bg-emerald-600' : 'justify-start bg-stone-500'
            }`}
          >
            <motion.span
              layout
              transition={{ type: 'spring', stiffness: 500, damping: 32 }}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-stone-700 shadow"
            >
              {mutation.isPending && <Spinner className="h-4 w-4" />}
            </motion.span>
          </button>
        </div>
      )}
    </Card>
  );
}

const STATE_LABEL = {
  ok: 'Operational',
  degraded: 'Degraded',
  error: 'Unreachable',
  loading: 'Checking...',
};

function SystemCard({ index }) {
  const apiQ = useApiHealth();
  const dbQ = useDbHealth();
  const apiState = apiQ.isPending ? 'loading' : apiQ.isError ? 'error' : 'ok';
  const dbState = dbQ.isPending
    ? 'loading'
    : dbQ.isError
      ? 'error'
      : dbQ.data?.status === 'ok'
        ? 'ok'
        : 'degraded';

  return (
    <Card index={index} label="System status">
      <h2 className="text-lg font-semibold">System</h2>
      <ul className="mt-4 space-y-3">
        {[
          ['API server', apiState],
          ['Database', dbState],
        ].map(([name, state]) => (
          <li key={name} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-stone-600">{name}</span>
            <span className="inline-flex items-center gap-2 font-medium text-stone-800">
              <StatusDot state={state} />
              {STATE_LABEL[state]}
            </span>
          </li>
        ))}
      </ul>
      <Link
        to="/status"
        className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-brand-700 underline-offset-2 hover:underline"
      >
        Full status page
      </Link>
    </Card>
  );
}

export default function OverviewPage() {
  const user = useSession((s) => s.user);
  const first = (user?.name || '').trim().split(' ')[0];

  return (
    <>
      <PageHeader
        title={first ? `Welcome back, ${first}` : 'Welcome back'}
        subtitle="Here is how the café looks right now."
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
        <AcceptingOrdersCard index={0} />
        <SystemCard index={1} />
      </div>
    </>
  );
}