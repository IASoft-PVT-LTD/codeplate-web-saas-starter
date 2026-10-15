import { LinkButton } from '@/components/ui';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-sm font-semibold text-brand">404</p>
      <h1 className="text-3xl font-bold">We couldn't find that page.</h1>
      <LinkButton href="/" variant="secondary">Go home</LinkButton>
    </main>
  );
}
