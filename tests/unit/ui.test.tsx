// The small UI states every page relies on, rendered to HTML: the toast, the
// loading outline, the error panel and the landing page's content.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Toast } from '@/components/ui';
import { ErrorPanel } from '@/components/error-panel';
import Loading from '@/app/(app)/loading';
import { landing } from '@/config/landing';
import { plans } from '@/config/plans';

describe('ui states', () => {
  it('announces a toast politely to screen readers', () => {
    const html = renderToStaticMarkup(<Toast>Saved.</Toast>);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('Saved.');
  });

  it('labels the loading outline for screen readers', () => {
    const html = renderToStaticMarkup(<Loading />);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-label="Loading"');
  });

  it('offers a retry and shows the error code, never the message', () => {
    const html = renderToStaticMarkup(<ErrorPanel digest="abc123" retry={() => {}} />);
    expect(html).toContain('Something went wrong.');
    expect(html).toContain('Try again');
    expect(html).toContain('abc123');
  });
});

describe('landing copy', () => {
  it('states the free plan limit from the plan config', () => {
    expect(landing.hero.note).toContain(String(plans.free.limits.projects));
  });

  it('marks made-up quotes as placeholders (never ship invented customers)', () => {
    for (const q of landing.proof.quotes) {
      if (/example|sample|placeholder/i.test(q.name)) expect(q.placeholder, q.name).toBe(true);
    }
  });
});
