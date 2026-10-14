// The image link previews show (Slack, X, LinkedIn, iMessage…), made at build
// time from the product's name and tagline. Next adds the og:image tags by
// itself. Its colors are in `site.shareImage` (src/config/site.ts).
import { ImageResponse } from 'next/og';
import { site } from '@/config/site';

export const alt = `${site.name}: ${site.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  const { background, text } = site.shareImage;
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 80, background, color: text }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, fontSize: 40, fontWeight: 700 }}>
          <svg width="64" height="64" viewBox="0 0 32 32">
            <rect width="32" height="32" rx="9" fill={text} />
            <path d="M10 21l6-12 6 12h-4l-2-4-2 4z" fill={background} />
          </svg>
          {site.name}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>{site.tagline}</div>
          <div style={{ fontSize: 32, opacity: 0.85 }}>{site.description}</div>
        </div>
      </div>
    ),
    size,
  );
}
