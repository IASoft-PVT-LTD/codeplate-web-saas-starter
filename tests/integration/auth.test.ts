// Sign-up, sign-in, verification email and password reset, against the real
// auth setup (src/lib/auth.ts) on an in-memory database.
import { beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { user } from '@/db/schema';
import { firstUrl, lastMail, makeUser, setup, type Ctx } from '../helpers';

let ctx: Ctx;
beforeAll(async () => {
  ctx = await setup();
});

describe('auth', () => {
  it('signs up a user and sends a verification email', async () => {
    const u = await makeUser(ctx);
    const mail = await lastMail(ctx, u.email);
    expect(mail?.subject).toMatch(/confirm your email/i);
    expect(firstUrl(mail.text)).toContain('/api/auth/verify-email?token=');
  });

  it('signs in with the right password only', async () => {
    const u = await makeUser(ctx);
    const ok = await ctx.auth.api.signInEmail({ body: { email: u.email, password: u.password } });
    expect(ok.user.email).toBe(u.email);
    await expect(ctx.auth.api.signInEmail({ body: { email: u.email, password: 'wrong password!' } })).rejects.toThrow();
  });

  it('refuses a second account with the same email', async () => {
    const u = await makeUser(ctx);
    await expect(makeUser(ctx, { email: u.email })).rejects.toThrow();
  });

  it('refuses short passwords', async () => {
    await expect(makeUser(ctx, { password: 'short' })).rejects.toThrow();
  });

  it('verifies the email from the link', async () => {
    const u = await makeUser(ctx);
    const token = new URL(firstUrl((await lastMail(ctx, u.email)).text)).searchParams.get('token')!;
    await ctx.auth.api.verifyEmail({ query: { token } });
    const [row] = await ctx.db.select().from(user).where(eq(user.id, u.id));
    expect(row.emailVerified).toBe(true);
  });

  it('resets a password from the emailed link', async () => {
    const u = await makeUser(ctx);
    await ctx.auth.api.requestPasswordReset({ body: { email: u.email, redirectTo: '/reset-password' } });
    const mail = await lastMail(ctx, u.email);
    expect(mail.subject).toMatch(/reset/i);
    const url = firstUrl(mail.text);
    const token = url.match(/reset-password\/([^?]+)/)?.[1] ?? new URL(url).searchParams.get('token');
    expect(token).toBeTruthy();
    await ctx.auth.api.resetPassword({ body: { newPassword: 'a brand new password', token: token! } });
    await expect(ctx.auth.api.signInEmail({ body: { email: u.email, password: u.password } })).rejects.toThrow();
    const ok = await ctx.auth.api.signInEmail({ body: { email: u.email, password: 'a brand new password' } });
    expect(ok.user.id).toBe(u.id);
  });
});
