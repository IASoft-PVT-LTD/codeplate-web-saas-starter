'use client';
// Shown only when the root layout itself fails. It replaces the whole page, so
// it brings its own <html>, <body> and styles.
import { ErrorPanel } from '@/components/error-panel';
import { site } from '@/config/site';
import './globals.css';

export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <title>{`Error · ${site.name}`}</title>
        <main className="flex min-h-screen items-center px-6">
          <ErrorPanel digest={error.digest} retry={retry} />
        </main>
      </body>
    </html>
  );
}
