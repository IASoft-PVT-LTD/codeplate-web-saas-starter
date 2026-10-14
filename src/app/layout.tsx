import type { Metadata } from 'next';
import { site } from '@/config/site';
import { env } from '@/lib/env';
import './globals.css';

export const metadata: Metadata = {
  // Makes the share image's URL absolute (APP_URL in .env.example).
  metadataBase: new URL(env.appUrl),
  title: { default: site.name, template: `%s · ${site.name}` },
  description: site.description,
  openGraph: { siteName: site.name, type: 'website' },
  twitter: { card: 'summary_large_image' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
