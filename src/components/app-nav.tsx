'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const path = usePathname();
  const active = path === href || path.startsWith(`${href}/`);
  return (
    <Link href={href} aria-current={active ? 'page' : undefined}
      className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${active ? 'bg-brand-soft text-brand' : 'text-ink-soft hover:bg-canvas hover:text-ink'}`}>
      {children}
    </Link>
  );
}

export function SignOutButton() {
  const router = useRouter();
  return (
    <button className="mt-2 text-ink-soft underline hover:text-ink" onClick={async () => {
      await authClient.signOut();
      router.push('/');
      router.refresh();
    }}>Sign out</button>
  );
}
