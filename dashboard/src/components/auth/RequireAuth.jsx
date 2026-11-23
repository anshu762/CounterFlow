import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { bootstrap, endSession, useSession } from '../../lib/session';
import FullScreenLoader from '../ui/FullScreenLoader';
import ErrorState from '../ui/ErrorState';

export default function RequireAuth() {
  const status = useSession((s) => s.status);
  const bootError = useSession((s) => s.bootError);
  const location = useLocation();

  if (status === 'booting') return <FullScreenLoader label="Checking your session..." />;

  if (status === 'unreachable') {
    return (
      <main className="mx-auto flex min-h-screen max-w-md items-center px-4">
        <ErrorState
          title="Cannot reach the server"
          message={bootError}
          onRetry={() => bootstrap()}
          onSecondary={() => endSession()}
          secondaryLabel="Sign in again"
        />
      </main>
    );
  }

  if (status === 'anon') {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  return <Outlet />;
}