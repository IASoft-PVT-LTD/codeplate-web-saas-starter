import Link from 'next/link';
import { site } from '@/config/site';

/** The product mark and name. Replace the SVG when re-branding. */
export function Logo({ href = '/' }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 font-bold tracking-tight text-ink">
      <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="9" className="fill-brand" />
        <path d="M10 21l6-12 6 12h-4l-2-4-2 4z" className="fill-on-brand" />
      </svg>
      <span>{site.name}</span>
    </Link>
  );
}
