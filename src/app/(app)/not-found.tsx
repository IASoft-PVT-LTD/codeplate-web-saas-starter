import { LinkButton } from '@/components/ui';

// A 404 inside the app (the sidebar stays): a record that doesn't exist or
// isn't the user's, or /admin for non-admins. Other unknown URLs get
// src/app/not-found.tsx.
export default function AppNotFound() {
  return (
    <div className="py-16 text-center">
      <p className="text-sm font-semibold text-brand">404</p>
      <h1 className="mt-2 text-3xl font-bold">We couldn't find that page.</h1>
      <p className="mt-4 text-ink-soft">It may have been deleted, or the link is wrong.</p>
      <div className="mt-8"><LinkButton href="/dashboard" variant="secondary">Back to the dashboard</LinkButton></div>
    </div>
  );
}
