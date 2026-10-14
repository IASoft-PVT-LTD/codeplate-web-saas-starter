# Set up Paddle (sandbox, then live)

Use when the user wants real checkout instead of the development billing simulator: connecting Paddle Billing from zero in its sandbox, testing payments and webhooks, then switching to live.

How billing works here (read once): the Billing page opens Paddle's checkout overlay (by itself when it's reached as `/billing?plan=<id>`, the plan picked on the pricing page) (`src/components/checkout-button.tsx`) with the plan's price id and `customData: { userId }`. Paddle charges the customer, handles tax, then sends `subscription.*` webhooks to `/api/paddle/webhook`. `src/lib/billing.ts` checks the signature, ignores repeats, and records the subscription through `applySubscriptionEvent()`. `src/lib/entitlements.ts` reads that table. "Manage subscription" opens Paddle's customer portal through the API. **The code needs no changes.** This recipe is dashboard work plus environment variables.

`paddleConfigured()` in `src/lib/env.ts` is true once `PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET` and `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` are all set. From then on, the Billing page shows real checkout buttons and **the dev billing simulator turns off**. The checks never use Paddle: `scripts/e2e-server.mjs` blanks those three variables, so `npm run check` keeps using the simulator even with keys in `.env.local`.

You can't create Paddle accounts or keys. The user does the dashboard steps. Tell them exactly what to click, ask them for the values, and have them paste secrets into `.env.local` themselves (never into code or chat logs you keep). Paddle's sandbox and live accounts are separate: products, prices, keys, destinations and settings must be created in each.

## A. Sandbox

1. **Sandbox account.** The user signs up at https://sandbox-vendors.paddle.com/signup. The sandbox needs no website approval and takes test cards only.
2. **Products and prices, matching `src/config/plans.ts`.** For each paid plan (Pro and Team by default; Free has no price): **Catalog** → **Products** → **New product**. Use the plan's `name`, a tax category of standard digital goods / SaaS, then **Save**. Open the product, and under **Prices** click **New price**: a recurring price, billed every 1 month, with the amount from the plan's `price` (`$12`, `$29`), then **Save**. Copy each price id (`pri_…`). If the user changed plans or prices (`change-plans-and-prices.md`), create prices for those instead. The `price` text in `plans.ts` is only what the pricing page shows: Paddle charges what its price says, so keep them equal.
3. **Default payment link.** **Checkout** → **Checkout configuration** → **Default payment link**: enter the site's URL, or `https://localhost/` while there's no site yet, then **Save**. Without it, Paddle can't create the checkout transaction, and the overlay fails to open.
4. **Client-side token** (used in the browser by Paddle.js): **My account** → **Settings** → **Authentication** → **Client-side tokens** tab → **New client-side token**. Give it a name, **Save**, then copy it from the token's menu. Sandbox tokens start with `test_`. It's safe to expose, which is why it's `NEXT_PUBLIC_`.
5. **API key** (server only; used for the customer portal): same **Authentication** page → **API keys** tab → **New API key**. The app only calls `POST /customers/{id}/portal-sessions`, which needs the permission **`customer_portal_session.write`**; grant more only if you add other API calls. **Save** and copy the key right away. Sandbox keys start with `pdl_sdbx_apikey_`.
6. **Webhook destination:** **Events** → **Notifications** → **New destination**.
   - **Description**: e.g. `Launchpad sandbox`. **Notification type**: webhook. **URL**: `https://<public-host>/api/paddle/webhook`. Paddle must reach it from the internet; for local work, see step 9.
   - **Usage type**: both platform and simulation events, so Paddle's simulator can target it too.
   - **Events**: tick the subscription events: `subscription.created`, `subscription.updated`, `subscription.activated`, `subscription.trialing`, `subscription.past_due`, `subscription.paused`, `subscription.resumed`, `subscription.canceled` (and `subscription.imported` if they ever import subscriptions). The handler applies every `subscription.*` event and answers 200 to anything else, so extra events are harmless but useless.
   - **Save destination**, then copy its **secret key** (`pdl_ntfset_…`). It's shown in the destination's menu → **Edit destination**. Copy it straight away: parts of Paddle's docs say it can't be retrieved again.
7. **Put the values in `.env.local`** (the user does this; the names are in `.env.example`):
   ```bash
   NEXT_PUBLIC_PADDLE_ENV=sandbox
   NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=test_...
   PADDLE_API_KEY=pdl_sdbx_apikey_...
   PADDLE_WEBHOOK_SECRET=pdl_ntfset_...
   NEXT_PUBLIC_PADDLE_PRICE_PRO=pri_...
   NEXT_PUBLIC_PADDLE_PRICE_TEAM=pri_...
   ```
   Restart `npm run dev` after any change. `NEXT_PUBLIC_*` values are baked into the build, so a production server also needs a **rebuild** (not just a restart) when they change. A paid plan with an empty price id shows no upgrade button.
8. **Record it** in `docs/project.md` under Paddle: "sandbox", and the price ids (ids aren't secrets; keys are, so never record those).
9. **Receive webhooks locally.** Paddle can't call `localhost`. Pick one:
   - **A tunnel** (the full flow, checkout included): run `cloudflared tunnel --url http://localhost:3000` (Cloudflare quick tunnel; it prints an `https://….trycloudflare.com` URL) or `ngrok http 3000`, or `hookdeck listen 3000 paddle --path /api/paddle/webhook` (Paddle's docs suggest Hookdeck or ngrok). Put `https://<tunnel-host>/api/paddle/webhook` in the sandbox destination's URL (step 6). The tunnel URL changes on each run unless the user has a reserved one, so update it each time. Keep using the app at http://localhost:3000; only Paddle's webhook calls go through the tunnel.
   - **Paddle's simulator** (no checkout, needs the same public URL): **Events** → **Simulations** → **New simulation**. Pick the destination, choose a single event such as `subscription.created` or a scenario, then **Run simulation**. Simulated payloads carry Paddle's sample price ids and no `custom_data.userId`, so the app answers 200 with "…ignored". That proves delivery and the signature, not an upgrade.
   - **Check the secret offline.** With `npm run dev` running, this sends a correctly signed test event to the local webhook, using `PADDLE_WEBHOOK_SECRET` from `.env.local`:
     ```bash
     node --env-file=.env.local -e "
     const c = require('node:crypto');
     const body = JSON.stringify({ event_id: 'evt_local_' + Date.now(), event_type: 'local.ping', occurred_at: new Date().toISOString(), data: {} });
     const ts = Math.floor(Date.now() / 1000);
     const h1 = c.createHmac('sha256', process.env.PADDLE_WEBHOOK_SECRET).update(ts + ':' + body).digest('hex');
     fetch((process.env.APP_URL || 'http://localhost:3000') + '/api/paddle/webhook', { method: 'POST', headers: { 'paddle-signature': 'ts=' + ts + ';h1=' + h1 }, body })
       .then(async (r) => console.log(r.status, await r.text()));
     "
     ```
     `200 {"ok":true,"message":"ignored local.ping"}` means the route and secret work. `401 … bad signature` means a different secret.
10. **Test a payment** in the sandbox (see Verify). Paddle's test cards, with any name, any future expiry and any 3-digit CVC:
    - `4242 4242 4242 4242`: succeeds.
    - `4000 0038 0000 0446`: succeeds after a 3-D Secure challenge.
    - `4000 0000 0000 0002`: declined.

## B. Going live

11. **Live account and website approval.** The user signs in at https://vendors.paddle.com, completes Paddle's account verification, and adds the production domain under **My account** → **Settings** → **Website approval**. Paddle reviews the site, which needs real terms, privacy and pricing pages (replace the stubs in `src/app/(marketing)/legal/` first) and the product as it will be sold. Approval can take days, so start early.
12. **Repeat steps 2–6 in the live dashboard.** Live has its own products, prices (new `pri_…` ids), default payment link (a page on the approved domain, e.g. `https://<domain>/pricing`), a client-side token (`live_…`), an API key (`pdl_live_apikey_…`), and a notification destination pointing at `https://<domain>/api/paddle/webhook`, with its own secret.
13. **Set the live values on the host** (see `deploy.md`), not in `.env.local`:
    ```bash
    NEXT_PUBLIC_PADDLE_ENV=production
    NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=live_...
    PADDLE_API_KEY=pdl_live_apikey_...
    PADDLE_WEBHOOK_SECRET=pdl_ntfset_...
    NEXT_PUBLIC_PADDLE_PRICE_PRO=pri_...
    NEXT_PUBLIC_PADDLE_PRICE_TEAM=pri_...
    ```
    `NEXT_PUBLIC_PADDLE_ENV=production` switches both Paddle.js (`initializePaddle({ environment })`) and the API base (`https://api.paddle.com` instead of `https://sandbox-api.paddle.com`, in `src/lib/billing.ts`). Then **rebuild and redeploy**, because of the `NEXT_PUBLIC_*` values. Mixing sandbox and live values fails: a `test_` token with `production`, or a sandbox price id on live.
14. **Firewalls.** If the host has a WAF or bot protection (Cloudflare and others), let Paddle's requests reach `/api/paddle/webhook`. Paddle publishes its webhook source IPs, separately for sandbox and live, on its "Handle webhook delivery" page (developer.paddle.com/webhooks/about/respond-to-webhooks). The endpoint must answer within 5 seconds. It does: it only writes one or two rows.
15. **Record it** in `docs/project.md`: Paddle is live, with the live price ids.

## Troubleshooting

- **Checkout button stays disabled:** wrong or missing `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`, a token from the other environment, or a build that predates the variable. Check the browser console.
- **Overlay opens, then errors:** the default payment link isn't set (step 3), or on live, the domain isn't approved.
- **Paid, but the plan didn't change:** read the server log and Paddle's delivery log (**Events** → **Notifications** → the destination). `401 bad signature`: `PADDLE_WEBHOOK_SECRET` doesn't match the destination. `200 … isn't in config/plans.ts; ignored`: the price id env vars don't match the Paddle price (or the build predates them). `200 … no userId in custom_data`: the subscription wasn't started from this app's checkout button. Paddle retries non-2xx answers (3 times in sandbox, for days on live), and duplicates are ignored, so fixing the config and redelivering is safe.
- **"Manage subscription" fails:** the API key lacks `customer_portal_session.write`, or it's from the other environment.

## Verify

1. `npm run check` must end with `CODEPLATE CHECKS: PASS`, with the Paddle values in `.env.local`. The checks still use the simulator.
2. `npm run dev` (plus a tunnel, step 9). Sign up, open `/billing`: there's no "Paddle isn't set up yet" notice and no simulator buttons, just "Upgrade to Pro" / "Upgrade to Team".
3. Click **Upgrade to Pro**, and pay with `4242 4242 4242 4242`. You land on `/billing?success=1`. Within a few seconds a refresh shows "You're on the Pro plan", and the Free plan's project limit is gone on `/projects`. In Paddle, **Events** → **Notifications** shows the deliveries with response `200`.
4. **Manage subscription** opens Paddle's portal. Cancel there: the webhook marks the subscription to end at the period end (the Billing page says "Ends …"), and the plan stays until then.
5. On live, after deploying: do one real purchase on the cheapest plan with a real card, check the plan updates, then refund it from the Paddle dashboard.
