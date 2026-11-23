import { motion } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Spinner from '../ui/Spinner';
import { useSettings } from '../../hooks/useSettings';
import { api } from '../../lib/api';
import { describeError } from '../../lib/errors';
import { toast } from '../../lib/toast';

export default function AcceptingOrdersCard() {
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

  const accepting = Boolean(settingsQ.data?.acceptingOrders);

  return (
    <section
      aria-label="Accepting orders"
      className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-200 sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Customer orders</h2>
          <p className="mt-1 text-sm text-stone-600">
            {accepting
              ? 'Accepting orders. Customers can place orders in the app.'
              : 'Orders paused. Customers can see the menu but cannot order.'}{' '}
            This switch saves immediately.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={accepting}
          aria-label="Accepting orders"
          disabled={mutation.isPending || !settingsQ.data}
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
    </section>
  );
}