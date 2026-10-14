// Who is signed in, for server components, server actions and route handlers.
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAuth } from './auth';
import { env } from './env';

export type CurrentUser = { id: string; email: string; name: string; emailVerified: boolean };

export async function currentUser(): Promise<CurrentUser | null> {
  // Read the request first: it marks the page as per-request, so Next never
  // tries to render signed-in pages (or open the database) at build time.
  const h = await headers();
  const auth = await getAuth();
  const s = await auth.api.getSession({ headers: h });
  if (!s) return null;
  return { id: s.user.id, email: s.user.email, name: s.user.name, emailVerified: s.user.emailVerified };
}

/** The signed-in user, or a redirect to /sign-in. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await currentUser();
  if (!user) redirect('/sign-in');
  return user;
}

export function isAdmin(user: CurrentUser | null): boolean {
  return !!user && env.adminEmails.includes(user.email.toLowerCase());
}

/** The signed-in admin, or a 404 (the admin area doesn't advertise itself). */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await currentUser();
  if (!isAdmin(user)) {
    const { notFound } = await import('next/navigation');
    notFound();
  }
  return user!;
}
