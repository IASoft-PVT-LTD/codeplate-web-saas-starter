'use client';
// Better Auth on the browser side: sign in/up/out, password reset, profile.
import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient();

/** A readable message from a Better Auth error (or a fallback). */
export function authError(error: { message?: string; code?: string } | null | undefined, fallback = 'Something went wrong. Try again.'): string {
  return error?.message || fallback;
}
