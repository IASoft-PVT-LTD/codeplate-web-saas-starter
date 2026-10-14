// Paddle sends subscription events here (set the URL in Paddle → Events →
// Notifications). The logic and its tests are in lib/billing.ts.
import { getDb } from '@/db';
import { handlePaddleWebhook } from '@/lib/billing';

export async function POST(request: Request): Promise<Response> {
  const raw = await request.text(); // verify the exact bytes Paddle signed
  const result = await handlePaddleWebhook(await getDb(), raw, request.headers.get('paddle-signature'));
  if (result.status >= 400) console.warn(`[paddle] webhook rejected: ${result.message}`);
  return Response.json({ ok: result.status < 300, message: result.message }, { status: result.status });
}
