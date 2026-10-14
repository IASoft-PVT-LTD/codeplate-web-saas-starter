import type { FeatureIcon as Name } from '@/config/landing';

// Small line icons for the landing page's features, drawn for this template.
// Add a name to `FeatureIcon` in src/config/landing.ts and a path here.
const paths: Record<Name, React.ReactNode> = {
  status: (
    <>
      <circle cx="6" cy="7" r="2.5" />
      <path d="M11 7h9" />
      <circle cx="6" cy="17" r="2.5" />
      <path d="M11 17h6" />
      <path d="M4.8 7l.9.9 1.7-1.8" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
      <path d="M8 14.5h3" />
    </>
  ),
  dashboard: (
    <>
      <rect x="3.5" y="4" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="4" width="7" height="4" rx="1.5" />
      <rect x="13.5" y="11" width="7" height="9" rx="1.5" />
      <rect x="3.5" y="14" width="7" height="6" rx="1.5" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
      <path d="M12 14.5v2.5" />
    </>
  ),
  phone: (
    <>
      <rect x="7" y="3" width="10" height="18" rx="2.5" />
      <path d="M10.5 18h3" />
    </>
  ),
  moon: <path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z" />,
};

export function FeatureIcon({ name }: { name: Name }) {
  return (
    <span className="inline-flex size-10 items-center justify-center rounded-xl bg-brand-soft text-brand">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {paths[name]}
      </svg>
    </span>
  );
}
