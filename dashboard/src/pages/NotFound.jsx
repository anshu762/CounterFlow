import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-6xl font-extrabold text-brand-600">404</p>
      <h1 className="text-2xl font-bold">Page not found</h1>
      <Link
        to="/"
        className="inline-flex min-h-11 items-center rounded-xl bg-brand-600 px-5 font-semibold text-white hover:bg-brand-700"
      >
        Back to home
      </Link>
    </main>
  );
}