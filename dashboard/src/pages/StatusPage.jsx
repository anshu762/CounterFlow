import { motion } from 'framer-motion';
import { Coffee, Server, Database, RefreshCw } from 'lucide-react';
import StatusCard from '../components/StatusCard';
import { useApiHealth, useDbHealth } from '../hooks/useApiStatus';
import { API_URL } from '../lib/api';

function formatUptime(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function StatusPage() {
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

  const apiRows = apiQ.data
    ? [
        ['Service', apiQ.data.service],
        ['Version', apiQ.data.version],
        ['Environment', apiQ.data.environment],
        ['Uptime', formatUptime(apiQ.data.uptimeSeconds)],
      ]
    : [['Endpoint', API_URL]];

  const dbRows = dbQ.data?.database
    ? [
        ['Configured', dbQ.data.database.configured ? 'Yes' : 'No'],
        ['Connected', dbQ.data.database.ok ? 'Yes' : 'No'],
        ...(dbQ.data.database.latencyMs != null
          ? [['Latency', `${dbQ.data.database.latencyMs} ms`]]
          : []),
      ]
    : [['Endpoint', `${API_URL}/health/db`]];

  const fetching = apiQ.isFetching || dbQ.isFetching;

  function refresh() {
    apiQ.refetch();
    dbQ.refetch();
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Animated background blobs */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-brand-200/60 blur-3xl"
        animate={{ x: [0, 40, 0], y: [0, 30, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-amber-200/60 blur-3xl"
        animate={{ x: [0, -40, 0], y: [0, -30, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />

      <main className="relative mx-auto flex min-h-screen max-w-4xl flex-col justify-center px-4 py-12 sm:px-6">
        <motion.header
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8 text-center"
        >
          <motion.span
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/30"
            animate={{ rotate: [0, -6, 6, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Coffee size={32} aria-hidden="true" />
          </motion.span>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            Counter<span className="text-brand-600">Flow</span>
          </h1>
          <p className="mt-2 text-stone-600">System status</p>
        </motion.header>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
          <StatusCard title="API server" icon={Server} state={apiState} rows={apiRows}
            note={apiState === 'error' ? 'Cannot reach the API. Is the backend running?' : undefined}
            index={0} />
          <StatusCard title="Database (Neon)" icon={Database} state={dbState} rows={dbRows}
            note={dbState === 'degraded' ? 'API is up, but the database check failed.' : undefined}
            index={1} />
        </div>

        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={refresh}
            disabled={fetching}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-600 px-5 font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw size={18} className={fetching ? 'animate-spin' : ''} aria-hidden="true" />
            {fetching ? 'Checking…' : 'Refresh status'}
          </button>
        </div>
        <p className="mt-4 text-center text-xs text-stone-500">Auto-refreshes every 15 seconds</p>
      </main>
    </div>
  );
}