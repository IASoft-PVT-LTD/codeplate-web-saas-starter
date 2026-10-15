// The product's name and words. Change these first when re-branding
// (docs/recipes/retheme.md); colors live in src/app/globals.css, and the
// landing page's words in src/config/landing.ts.
export const site = {
  name: 'Launchpad',
  tagline: 'Plan projects without the busywork.',
  description: 'Launchpad keeps your projects, where each one stands and every deadline in one calm place.',
  // The core resource, as shown in the UI. Renaming it everywhere is
  // docs/recipes/rename-the-core-resource.md.
  resource: { one: 'project', many: 'projects' },
  supportEmail: 'support@example.com',
  // The share image link previews show (src/app/opengraph-image.tsx). It can't
  // read CSS variables: keep these in step with --color-brand and
  // --color-on-brand (light mode) in src/app/globals.css.
  shareImage: { background: '#5b5bd6', text: '#ffffff' },
  // Users must click the link in the verification email before signing in.
  requireEmailVerification: false,
} as const;
