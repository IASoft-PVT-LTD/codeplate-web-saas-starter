import { notFound } from 'next/navigation';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

// DEVELOPMENT ONLY: throws, so you (and tests/e2e/pages.spec.ts) can see the
// error page (src/app/error.tsx). A 404 in production.
export default function Crash() {
  if (!env.devTools) notFound();
  throw new Error('A test error from /dev/crash.');
}
