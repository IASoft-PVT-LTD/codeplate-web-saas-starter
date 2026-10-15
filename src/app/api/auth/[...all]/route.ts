// Better Auth's endpoints: /api/auth/sign-in/email, /api/auth/sign-up/email,
// /api/auth/verify-email, /api/auth/reset-password/<token>, and the rest.
import { getAuth } from '@/lib/auth';

async function handle(request: Request): Promise<Response> {
  const auth = await getAuth();
  return auth.handler(request);
}

export { handle as GET, handle as POST };
