'use client';
// Shown inside the app's layout (the sidebar stays) when a signed-in page throws.
import { useEffect } from 'react';
import { ErrorPanel } from '@/components/error-panel';

export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    // Send it to an error tracker here, if the project has one.
    console.error(error);
  }, [error]);
  return <ErrorPanel digest={error.digest} retry={retry} home="/dashboard" />;
}
