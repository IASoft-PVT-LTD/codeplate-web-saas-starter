// The small component set every page uses. Styling comes from the tokens in
// src/app/globals.css, so a re-theme rarely touches this file.
import Link from 'next/link';

type Cls = { className?: string };

const buttonStyles = {
  primary: 'bg-brand text-on-brand hover:bg-brand-strong',
  secondary: 'bg-paper text-ink border border-line hover:border-ink-soft',
  danger: 'bg-bad text-on-bad hover:opacity-90',
  ghost: 'text-ink-soft hover:text-ink',
};

export type ButtonVariant = keyof typeof buttonStyles;

export function buttonClass(variant: ButtonVariant = 'primary', className = ''): string {
  return `inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed ${buttonStyles[variant]} ${className}`;
}

export function Button({ variant = 'primary', className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return <button className={buttonClass(variant, className)} {...props} />;
}

export function LinkButton({ variant = 'primary', className, ...props }: React.ComponentProps<typeof Link> & { variant?: ButtonVariant }) {
  return <Link className={buttonClass(variant, className)} {...props} />;
}

const fieldClass = 'w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft';

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${fieldClass} ${props.className ?? ''}`} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={4} {...props} className={`${fieldClass} ${props.className ?? ''}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${fieldClass} ${props.className ?? ''}`} />;
}

/** A labelled form field with an optional hint and error. */
export function Field({ label, htmlFor, hint, error, children }: { label: string; htmlFor: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium">{label}</label>
      {children}
      {error ? <p className="text-sm text-bad" role="alert">{error}</p> : hint ? <p className="text-sm text-ink-soft">{hint}</p> : null}
    </div>
  );
}

/** A panel. `flush` drops the padding, for lists and tables whose rows pad themselves. */
export function Card({ className, flush, children }: Cls & { flush?: boolean; children: React.ReactNode }) {
  return <div className={`rounded-[var(--radius-card)] border border-line bg-paper ${flush ? '' : 'p-6'} ${className ?? ''}`}>{children}</div>;
}

const badgeStyles = {
  neutral: 'bg-canvas text-ink-soft border-line',
  brand: 'bg-brand-soft text-brand border-transparent',
  ok: 'bg-ok/10 text-ok border-transparent',
  warn: 'bg-warn/10 text-warn border-transparent',
  bad: 'bg-bad/10 text-bad border-transparent',
};

export function Badge({ tone = 'neutral', children }: { tone?: keyof typeof badgeStyles; children: React.ReactNode }) {
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${badgeStyles[tone]}`}>{children}</span>;
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 text-ink-soft">{description}</p> : null}
      </div>
      {actions ? <div className="flex gap-2">{actions}</div> : null}
    </div>
  );
}

export function Notice({ tone = 'brand', children }: { tone?: 'brand' | 'ok' | 'warn' | 'bad'; children: React.ReactNode }) {
  const styles = { brand: 'bg-brand-soft text-ink', ok: 'bg-ok/10 text-ok', warn: 'bg-warn/10 text-warn', bad: 'bg-bad/10 text-bad' };
  return <div role="status" className={`rounded-lg px-4 py-3 text-sm ${styles[tone]}`}>{children}</div>;
}

/**
 * A short confirmation in the corner of the screen ("Saved."), which fades
 * after a few seconds. Use it for success; put errors in a Notice next to the
 * form, where they stay. CSS-only (the `toast` animation in globals.css), so it
 * works in server and client components. To show it again for the next
 * success, give it a new `key` (forms use a timestamp).
 */
export function Toast({ children }: { children: React.ReactNode }) {
  return (
    <div role="status" aria-live="polite" className="toast pointer-events-none fixed inset-x-4 bottom-4 z-50 flex justify-center sm:inset-x-auto sm:right-6 sm:bottom-6">
      <div className="flex items-center gap-3 rounded-xl bg-ink px-4 py-3 text-sm font-medium text-paper shadow-lg">
        <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" className="shrink-0">
          <circle cx="10" cy="10" r="10" className="fill-ok" />
          <path d="M6 10.5l2.7 2.7L14.2 7.5" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="stroke-paper" />
        </svg>
        {children}
      </div>
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <Card className="py-14 text-center">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-ink-soft">{body}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </Card>
  );
}
