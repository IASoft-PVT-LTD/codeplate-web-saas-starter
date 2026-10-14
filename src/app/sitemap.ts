// /sitemap.xml: the public pages search engines should index. Add a public
// page here when you create one. URLs use APP_URL (read per request, so the
// deployed site lists its own address).
import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

const pages = ['/', '/pricing', '/legal/terms', '/legal/privacy'];

export default function sitemap(): MetadataRoute.Sitemap {
  return pages.map((path) => ({ url: new URL(path, env.appUrl).toString(), changeFrequency: 'monthly', priority: path === '/' ? 1 : 0.5 }));
}
