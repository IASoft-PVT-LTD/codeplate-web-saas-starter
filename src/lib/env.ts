// Server environment, read in one place. Every variable is listed (with
// comments) in .env.example. Secrets come only from the environment.

const isProd = process.env.NODE_ENV === 'production';

/**
 * The secret that signs sessions. Checked when auth starts (not at import,
 * so `next build` works without it): production refuses to run without one.
 */
export function authSecret(): string {
  const s = process.env.BETTER_AUTH_SECRET;
  if (s && s.length >= 32) return s;
  if (isProd && process.env.CODEPLATE_CHECKS !== '1') {
    throw new Error('BETTER_AUTH_SECRET must be set (32+ random characters) in production. See .env.example.');
  }
  return 'dev-only-secret-do-not-use-in-production-0000';
}

const checksMode = process.env.CODEPLATE_CHECKS === '1';

export const env = {
  isProd,
  /** True while `npm run check` runs the app (CODEPLATE_CHECKS=1). NEVER set it on a real deployment. */
  checksMode,
  /**
   * Dev-only tools (the /dev/outbox page and the billing simulator). On in
   * development; the checks also turn them on for production builds with
   * CODEPLATE_CHECKS=1. NEVER set CODEPLATE_CHECKS on a real deployment.
   */
  devTools: !isProd || checksMode,
  /** The site's public URL, used in emails and auth callbacks. */
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  /** Comma-separated emails that can open /admin. */
  adminEmails: (process.env.ADMIN_EMAILS ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
  paddle: {
    apiKey: process.env.PADDLE_API_KEY ?? '',
    webhookSecret: process.env.PADDLE_WEBHOOK_SECRET ?? '',
    environment: (process.env.NEXT_PUBLIC_PADDLE_ENV === 'production' ? 'production' : 'sandbox') as 'production' | 'sandbox',
    clientToken: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN ?? '',
  },
  email: {
    /** "console" (default: print and keep in the dev outbox) or "resend". */
    provider: (process.env.EMAIL_PROVIDER ?? 'console') as 'console' | 'resend',
    resendApiKey: process.env.RESEND_API_KEY ?? '',
    from: process.env.EMAIL_FROM ?? 'Launchpad <hello@example.com>',
  },
};

/** True when Paddle is set up enough to take real (or sandbox) payments. */
export function paddleConfigured(): boolean {
  return env.paddle.apiKey !== '' && env.paddle.webhookSecret !== '' && env.paddle.clientToken !== '';
}
