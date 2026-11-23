import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import EmptyState from '../components/ui/EmptyState';

export default function ForbiddenPage() {
  return (
    <>
      <PageHeader title="Access denied" />
      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-stone-200">
        <EmptyState
          icon={Lock}
          title="Only the owner can open this page"
          message="Ask the café owner if you need this changed."
          action={
            <Link
              to="/"
              className="mt-2 inline-flex min-h-11 items-center rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Back to overview
            </Link>
          }
        />
      </div>
    </>
  );
}