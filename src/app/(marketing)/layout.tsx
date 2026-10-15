import Link from 'next/link';
import { Logo } from '@/components/logo';
import { LinkButton } from '@/components/ui';
import { site } from '@/config/site';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line bg-paper">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Logo />
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/pricing" className="text-ink-soft hover:text-ink">Pricing</Link>
            <Link href="/sign-in" className="text-ink-soft hover:text-ink">Sign in</Link>
            <LinkButton href="/sign-up">Start free</LinkButton>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-line bg-paper">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-sm text-ink-soft">
          <span>
            © {new Date().getFullYear()} {site.name} ·{' '}
            {/* Required by the template's free license (LICENSE.md). */}
            <a href="https://codeplate.io" className="underline-offset-2 hover:underline">
              Built with CodePlate (codeplate.io)
            </a>
          </span>
          <nav className="flex gap-6">
            <Link href="/pricing">Pricing</Link>
            <Link href="/legal/terms">Terms</Link>
            <Link href="/legal/privacy">Privacy</Link>
            <a href={`mailto:${site.supportEmail}`}>Contact</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
