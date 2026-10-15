// /robots.txt: crawl the public pages; skip the APIs and dev tools. The
// signed-in pages redirect crawlers to /sign-in, so they need no rule.
import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/dev/'] },
    sitemap: new URL('/sitemap.xml', env.appUrl).toString(),
  };
}
