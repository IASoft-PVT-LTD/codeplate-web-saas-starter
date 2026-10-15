// Input validation for everything users submit. Server actions parse with
// these before touching the database; forms show the messages.
import { z } from 'zod';

export const projectInput = z.object({
  name: z.string().trim().min(1, 'Give it a name.').max(80, 'Keep the name under 80 characters.'),
  description: z.string().trim().max(2000, 'Keep the description under 2000 characters.').default(''),
  status: z.enum(['planned', 'active', 'done']).default('planned'),
  dueDate: z.union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-12-31.')])
    // default(null), not default(''): zod returns a default as-is, skipping the transform.
    .transform((v) => (v === '' ? null : v)).default(null),
});
export type ProjectInput = z.infer<typeof projectInput>;

export const profileInput = z.object({
  name: z.string().trim().min(1, 'Enter your name.').max(80),
});

/** Turns form data into a plain object for a zod schema. */
export function formObject(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === 'string') out[k] = v;
  return out;
}

/** First message per field, for showing next to inputs. */
export function fieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = String(issue.path[0] ?? 'form');
    out[key] ??= issue.message;
  }
  return out;
}
