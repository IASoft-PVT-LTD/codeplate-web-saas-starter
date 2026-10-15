# Customization map

"I want to change X." Here is where to go. If a recipe exists, follow it.

| I want to… | Change | Recipe |
|---|---|---|
| Rename the product, tagline, description | `src/config/site.ts` | `recipes/retheme.md` |
| Change colors (light and dark) | `src/app/globals.css` (`@theme` tokens) | `recipes/retheme.md` |
| Change fonts | `src/app/globals.css`, `src/app/layout.tsx` | `recipes/retheme.md` |
| Replace the logo or favicon | `src/components/logo.tsx`, `src/app/icon.*` | `recipes/retheme.md` |
| Rewrite the landing page (hero, features, quotes, pricing teaser) | `src/config/landing.ts`; layout in `src/app/(marketing)/page.tsx` | `recipes/retheme.md` |
| Replace the landing illustration | `src/components/hero-art.tsx` | `recipes/retheme.md` |
| The link-preview image, sitemap, robots.txt | `src/app/opengraph-image.tsx` (colors in `site.ts`), `src/app/sitemap.ts`, `src/app/robots.ts` | `recipes/retheme.md` |
| The error, loading and 404 pages | `src/components/error-panel.tsx`, `src/app/(app)/loading.tsx`, `src/app/not-found.tsx`, `src/app/(app)/not-found.tsx` | — |
| Success messages (toasts) | `Toast` in `src/components/ui.tsx`, timing in `src/app/globals.css` | — |
| Edit terms and privacy | `src/app/(marketing)/legal/terms/page.tsx`, `privacy/page.tsx` | — |
| Turn "projects" into my thing | schema, `src/lib/projects.ts`, routes, `site.ts` … | `recipes/rename-the-core-resource.md` |
| Add a field to it | `src/db/schema.ts`, `src/lib/schemas.ts`, `src/components/project-form.tsx` | `recipes/add-a-field.md` |
| Add another kind of thing (tasks, clients…) | new table, lib file, pages | `recipes/add-a-resource.md` |
| Change the statuses (planned/active/done) | `src/db/schema.ts`, `src/lib/schemas.ts`, `project-form.tsx`, `status-badge.tsx` | `recipes/add-a-field.md` |
| Change plans, prices, features | `src/config/plans.ts` | `recipes/change-plans-and-prices.md` |
| Change what the free plan allows | `limits` in `src/config/plans.ts`, checks in `src/lib/entitlements.ts` | `recipes/change-plans-and-prices.md` |
| Where a plan picked on the pricing page leads (sign-up → checkout) | `paidPlanId`, `afterAuthPath` in `src/config/plans.ts`; `src/app/(auth)/`, `src/app/(app)/billing/page.tsx` | `recipes/change-plans-and-prices.md` |
| Take real payments | Paddle dashboard, `.env.local` | `recipes/set-up-paddle.md` |
| Change what happens on payment events | `src/lib/billing.ts` (`applySubscriptionEvent`) | `recipes/set-up-paddle.md` |
| Sign in with Google or GitHub | `src/lib/auth.ts`, sign-in and sign-up pages | `recipes/add-oauth-login.md` |
| Require email verification | `requireEmailVerification` in `src/config/site.ts` | `recipes/add-email-provider.md` |
| Send real emails | `EMAIL_PROVIDER` in `.env.local`, `src/lib/mailer.ts` | `recipes/add-email-provider.md` |
| Change email wording | `sendResetPassword` / `sendVerificationEmail` in `src/lib/auth.ts` | — |
| Teams, members, roles | Better Auth's organization plugin | `recipes/add-teams.md` (two stages) |
| A JSON API | `src/app/api/<name>/route.ts` | `recipes/add-an-api-endpoint.md` |
| Change the app's navigation | `src/app/(app)/layout.tsx` | — |
| Change the dashboard | `src/app/(app)/dashboard/page.tsx` | — |
| Change settings (profile, password, delete account) | `src/app/(app)/settings/page.tsx`, `src/components/settings-forms.tsx` | — |
| Choose who can open /admin | `ADMIN_EMAILS` | — |
| Change the shared UI (buttons, cards, fields) | `src/components/ui.tsx` | — |
| Change the demo data | `scripts/seed.ts` | — |
| Use a hosted Postgres | `DATABASE_URL`, then `npm run db:migrate` | `recipes/deploy.md` |
| Go live | hosting, env vars, migrations | `recipes/deploy.md` |
| Add an environment variable | `src/lib/env.ts` and `.env.example` (the checks require both) | — |
