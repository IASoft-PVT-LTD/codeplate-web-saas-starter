'use client';
// Shown when a public page (or one with no closer error.tsx) throws. Pages in
// the signed-in app use (app)/error.tsx, which keeps the sidebar.
import { useEffect } from 'react';
import { ErrorPanel } from '@/components/error-panel';

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    // Send it to an error tracker here, if the project has one.
    console.error(error);
  }, [error]);
  return (
    <main className="flex min-h-screen items-center px-6">
      <ErrorPanel digest={error.digest} retry={retry} />
    </main>
  );
}
