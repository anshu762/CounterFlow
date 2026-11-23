import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import StatusPage from './pages/StatusPage';
import NotFound from './pages/NotFound';
import RequireAuth from './components/auth/RequireAuth';
import RequireRole from './components/auth/RequireRole';
import AppShell from './components/layout/AppShell';
import { NAV_ITEMS } from './components/layout/nav';
import FullScreenLoader from './components/ui/FullScreenLoader';
import Toaster from './components/ui/Toaster';
import { bootstrap } from './lib/session';
import { useCafe } from './hooks/useCafe';
import { applyTheme } from './theme/applyTheme';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const OverviewPage = lazy(() => import('./pages/OverviewPage'));
const ComingSoonPage = lazy(() => import('./pages/ComingSoonPage'));

const soonRoutes = (items) =>
  items.map((item) => (
    <Route
      key={item.to}
      path={item.to.slice(1)}
      element={<ComingSoonPage title={item.label} phase={item.phase} blurb={item.blurb} />}
    />
  ));

const SOON = NAV_ITEMS.filter((item) => item.soon);

export default function App() {
  const { data: cafe } = useCafe();
  const theme = cafe?.theme ?? null;

  useEffect(() => {
    bootstrap();
  }, []);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return (
    // reducedMotion="user": animations switch off for users who requested it in their OS.
    <MotionConfig reducedMotion="user">
      <Suspense fallback={<FullScreenLoader label="Loading..." />}>
        <Routes>
          <Route path="/status" element={<StatusPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route element={<RequireAuth />}>
            <Route element={<AppShell />}>
              <Route index element={<OverviewPage />} />
              {soonRoutes(SOON.filter((item) => !item.roles))}
              <Route element={<RequireRole roles={['owner']} />}>
                {soonRoutes(SOON.filter((item) => item.roles))}
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      <Toaster />
    </MotionConfig>
  );
}