import { Hammer } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import EmptyState from '../components/ui/EmptyState';

export default function ComingSoonPage({ title, phase, blurb }) {
  return (
    <>
      <PageHeader title={title} />
      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-stone-200">
        <EmptyState
          icon={Hammer}
          title="Coming soon"
          message={`${blurb} This page is planned for ${phase}.`}
        />
      </div>
    </>
  );
}