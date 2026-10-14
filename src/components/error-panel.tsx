'use client';
import { site } from '@/config/site';
import { Button, LinkButton } from './ui';

/**
 * What people see when a page fails (src/app/error.tsx, (app)/error.tsx,
 * global-error.tsx). `digest` is the id Next logs on the server with the
 * real error; the message itself is hidden in production on purpose.
 */
export function ErrorPanel({ digest, retry, home = '/' }: { digest?: string; retry: () => void; home?: string }) {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <p className="text-sm font-semibold text-bad">Error</p>
      <h1 className="mt-2 text-3xl font-bold">Something went wrong.</h1>
      <p className="mt-4 text-ink-soft">
        The page hit a problem on our side. Try again. If it keeps happening, email{' '}
        <a href={`mailto:${site.supportEmail}`} className="text-brand underline">{site.supportEmail}</a>
        {digest ? <> and mention the code <code className="rounded bg-canvas px-1 text-ink">{digest}</code></> : null}.
      </p>
      <div className="mt-8 flex justify-center gap-3">
        <Button onClick={() => retry()}>Try again</Button>
        <LinkButton href={home} variant="secondary">Go home</LinkButton>
      </div>
    </div>
  );
}
