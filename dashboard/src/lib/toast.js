import { create } from 'zustand';

let nextId = 1;

export const useToasts = create(() => ({ items: [] }));

export function dismissToast(id) {
  useToasts.setState((s) => ({ items: s.items.filter((t) => t.id !== id) }));
}

function push(kind, message) {
  const id = nextId++;
  useToasts.setState((s) => ({ items: [...s.items.slice(-3), { id, kind, message }] }));
  setTimeout(() => dismissToast(id), kind === 'error' ? 7000 : 4000);
  return id;
}

export const toast = {
  success: (message) => push('success', message),
  error: (message) => push('error', message),
  info: (message) => push('info', message),
};