import { Outlet } from 'react-router-dom';
import { useSession } from '../../lib/session';
import ForbiddenPage from '../../pages/ForbiddenPage';

// UI convenience only. The API re-checks the role on every owner-only call.
export default function RequireRole({ roles }) {
  const role = useSession((s) => s.role);
  if (!roles.includes(role)) return <ForbiddenPage />;
  return <Outlet />;
}