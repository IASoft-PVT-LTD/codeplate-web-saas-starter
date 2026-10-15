import { Logo } from '@/components/logo';
import { NavLink, SignOutButton } from '@/components/app-nav';
import { isAdmin, requireUser } from '@/lib/session';
import { site } from '@/config/site';

// Everything under (app) needs a signed-in user.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const cap = site.resource.many[0].toUpperCase() + site.resource.many.slice(1);
  return (
    <div className="min-h-screen md:flex">
      <aside className="border-b border-line bg-paper md:min-h-screen md:w-60 md:border-r md:border-b-0">
        <div className="flex items-center justify-between px-5 py-4 md:block">
          <Logo href="/dashboard" />
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:pb-0">
          <NavLink href="/dashboard">Dashboard</NavLink>
          <NavLink href="/projects">{cap}</NavLink>
          <NavLink href="/billing">Billing</NavLink>
          <NavLink href="/settings">Settings</NavLink>
          {isAdmin(user) ? <NavLink href="/admin">Admin</NavLink> : null}
        </nav>
        <div className="hidden px-5 py-6 text-sm md:block">
          <p className="truncate text-ink-soft" title={user.email}>{user.email}</p>
          <SignOutButton />
        </div>
      </aside>
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">{children}</main>
    </div>
  );
}
