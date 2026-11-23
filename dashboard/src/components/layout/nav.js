import { ClipboardList, LayoutDashboard, Settings, Star, TrendingUp, UtensilsCrossed, Users } from 'lucide-react';

// `soon: true` shows a "coming soon" page until the real page is built.
// `roles` limits the item to those roles (omit = owner and staff).
export const NAV_ITEMS = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  {
    to: '/orders',
    label: 'Live orders',
    icon: ClipboardList,
    soon: true,
    phase: 'Phase 3',
    blurb: 'New orders arrive here live, and you move them from placed to completed.',
  },
  {
    to: '/menu',
    label: 'Menu',
    icon: UtensilsCrossed,
    soon: true,
    phase: 'Phase 1G',
    blurb: 'Manage categories, items, sizes, photos and availability.',
  },
  {
    to: '/feedback',
    label: 'Feedback',
    icon: Star,
    soon: true,
    phase: 'Phase 3',
    blurb: 'Read what customers say and spot problems early.',
  },
  {
    to: '/analytics',
    label: 'Analytics',
    icon: TrendingUp,
    soon: true,
    phase: 'Phase 5',
    blurb: 'Sales, busy hours and best sellers across app and walk-in orders.',
  },
  { to: '/settings', label: 'Settings', icon: Settings },
  {
    to: '/staff',
    label: 'Staff',
    icon: Users,
    roles: ['owner'],
    soon: true,
    phase: 'Phase 3',
    blurb: 'Add staff, reset passwords and switch accounts on or off.',
  },
];