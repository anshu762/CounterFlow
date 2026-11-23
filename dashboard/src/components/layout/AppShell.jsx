import { Suspense, useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Coffee, Ellipsis, LogOut, X } from 'lucide-react';
import ErrorBoundary from '../ui/ErrorBoundary';
import Spinner from '../ui/Spinner';
import { NAV_ITEMS } from './nav';
import { logout, useSession } from '../../lib/session';
import { useCafe } from '../../hooks/useCafe';
import { toast } from '../../lib/toast';

const sideLinkClass = ({ isActive }) =>
  `flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors md:justify-center lg:justify-start ${
    isActive ? 'bg-brand-50 text-brand-700' : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
  }`;

const bottomLinkClass = ({ isActive }) =>
  `flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium ${
    isActive ? 'text-brand-700' : 'text-stone-600'
  }`;

function Sidebar({ items }) {
  return (
    <aside className="sticky top-0 hidden h-screen shrink-0 flex-col border-r border-stone-200 bg-white md:flex md:w-[76px] lg:w-64">
      <div className="flex h-16 items-center gap-3 border-b border-stone-200 px-4 lg:px-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white">
          <Coffee size={20} aria-hidden="true" />
        </span>
        <span className="hidden font-display text-xl font-bold lg:block">
          Counter<span className="text-brand-600">Flow</span>
        </span>
      </div>
      <nav aria-label="Main" className="flex-1 space-y-1 overflow-y-auto p-3">
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} title={label} className={sideLinkClass}>
            <Icon size={20} aria-hidden="true" className="shrink-0" />
            <span className="sr-only lg:not-sr-only">{label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

function TopBar({ cafeName, name, role, onSignOut }) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-stone-200 bg-white/90 px-4 backdrop-blur md:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white md:hidden">
          <Coffee size={20} aria-hidden="true" />
        </span>
        <p className="truncate font-display text-lg font-semibold">{cafeName}</p>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden text-right sm:block">
          <p className="max-w-48 truncate text-sm font-semibold text-stone-800">{name}</p>
          <p className="text-xs capitalize text-stone-500">{role}</p>
        </div>
        <span
          aria-hidden="true"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-700"
        >
          {name.charAt(0).toUpperCase()}
        </span>
        <button
          type="button"
          onClick={onSignOut}
          aria-label="Sign out"
          className="hidden min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium text-stone-700 hover:bg-stone-100 md:inline-flex"
        >
          <LogOut size={18} aria-hidden="true" />
          <span className="hidden lg:inline">Sign out</span>
        </button>
      </div>
    </header>
  );
}

function BottomNav({ items, name, role, onSignOut }) {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const moreRef = useRef(null);

  const needsMore = items.length > 5;
  const primary = needsMore ? items.slice(0, 4) : items;
  const extra = needsMore ? items.slice(4) : [];
  const moreActive = extra.some((i) => i.to !== '/' && pathname.startsWith(i.to));

  useEffect(() => {
    if (!open) return undefined;
    const moreButton = moreRef.current;
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      moreButton?.focus();
    };
  }, [open]);

  return (
    <>
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-stone-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {primary.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={bottomLinkClass}>
            <Icon size={22} aria-hidden="true" />
            {label}
          </NavLink>
        ))}
        {needsMore && (
          <button
            ref={moreRef}
            type="button"
            onClick={() => setOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={open}
            className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium ${
              moreActive ? 'text-brand-700' : 'text-stone-600'
            }`}
          >
            <Ellipsis size={22} aria-hidden="true" />
            More
          </button>
        )}
      </nav>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="backdrop"
              className="fixed inset-0 z-40 bg-stone-900/40 md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              aria-hidden="true"
            />
            <motion.div
              key="sheet"
              role="dialog"
              aria-modal="true"
              aria-label="More navigation"
              className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl md:hidden"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-stone-800">{name}</p>
                  <p className="text-xs capitalize text-stone-500">{role}</p>
                </div>
                <button
                  type="button"
                  autoFocus
                  onClick={() => setOpen(false)}
                  aria-label="Close menu"
                  className="flex h-11 w-11 items-center justify-center rounded-xl text-stone-600 hover:bg-stone-100"
                >
                  <X size={20} aria-hidden="true" />
                </button>
              </div>
              <div className="space-y-1">
                {extra.map(({ to, label, icon: Icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      `flex min-h-12 items-center gap-3 rounded-xl px-3 font-medium ${
                        isActive ? 'bg-brand-50 text-brand-700' : 'text-stone-700 hover:bg-stone-100'
                      }`
                    }
                  >
                    <Icon size={20} aria-hidden="true" />
                    {label}
                  </NavLink>
                ))}
                <button
                  type="button"
                  onClick={onSignOut}
                  className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 font-medium text-stone-700 hover:bg-stone-100"
                >
                  <LogOut size={20} aria-hidden="true" />
                  Sign out
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function PageLoader() {
  return (
    <div role="status" className="flex justify-center py-20 text-brand-600">
      <Spinner className="h-8 w-8" />
      <span className="sr-only">Loading page</span>
    </div>
  );
}

export default function AppShell() {
  const location = useLocation();
  const user = useSession((s) => s.user);
  const role = useSession((s) => s.role);
  const { data: cafe } = useCafe();

  const items = NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role));
  const name = user?.name || user?.email || 'Staff';

  async function handleSignOut() {
    await logout();
    toast.info('You have been signed out.');
  }

  function skipToContent(e) {
    e.preventDefault();
    document.getElementById('main')?.focus();
  }

  return (
    <div className="min-h-screen md:flex">
      <a
        href="#main"
        onClick={skipToContent}
        className="sr-only z-[70] rounded-lg bg-white px-4 py-2 font-semibold text-brand-700 shadow focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to content
      </a>
      <Sidebar items={items} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          cafeName={cafe?.name ?? 'CounterFlow'}
          name={name}
          role={role ?? 'staff'}
          onSignOut={handleSignOut}
        />
        <main
          id="main"
          tabIndex={-1}
          className="flex-1 px-4 py-6 pb-24 outline-none md:px-6 md:pb-8 lg:px-8"
        >
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="mx-auto w-full max-w-7xl"
          >
            <ErrorBoundary resetKey={location.pathname}>
              <Suspense fallback={<PageLoader />}>
                <Outlet />
              </Suspense>
            </ErrorBoundary>
          </motion.div>
        </main>
      </div>
      <BottomNav items={items} name={name} role={role ?? 'staff'} onSignOut={handleSignOut} />
    </div>
  );
}
