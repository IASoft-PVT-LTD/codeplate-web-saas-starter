// The landing page's product illustration: a simplified drawing of the app's
// dashboard. It's drawn with the theme tokens (fill-brand, fill-paper…), so it
// follows a retheme and dark mode by itself. Replace it with a real screenshot
// or the product's own illustration when there is one (docs/recipes/retheme.md).

const rows = [
  { title: 120, status: 'active' },
  { title: 92, status: 'planned' },
  { title: 140, status: 'planned' },
  { title: 80, status: 'done' },
] as const;

const pill = {
  active: { box: 'fill-brand-soft', bar: 'fill-brand' },
  planned: { box: 'fill-canvas stroke-line', bar: 'fill-ink-soft opacity-60' },
  done: { box: 'fill-ok/15', bar: 'fill-ok' },
};

export function HeroArt({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 640 470" className={`h-auto w-full ${className}`} aria-hidden="true" fontFamily="inherit">
      <defs>
        <clipPath id="hero-art-window">
          <rect x="24" y="30" width="520" height="360" rx="18" />
        </clipPath>
      </defs>

      {/* Backdrop */}
      <circle cx="482" cy="150" r="140" className="fill-brand-soft" />
      <circle cx="90" cy="400" r="70" className="fill-brand-soft opacity-70" />

      {/* The app window */}
      <g className="drop-shadow-xl">
        <rect x="24" y="30" width="520" height="360" rx="18" className="fill-paper" />
      </g>
      <g clipPath="url(#hero-art-window)">
        {/* Title bar */}
        <rect x="24" y="30" width="520" height="40" className="fill-canvas" />
        <circle cx="48" cy="50" r="5" className="fill-line" />
        <circle cx="64" cy="50" r="5" className="fill-line" />
        <circle cx="80" cy="50" r="5" className="fill-line" />
        <rect x="204" y="41" width="200" height="18" rx="9" className="fill-paper stroke-line" />
        <line x1="24" y1="70" x2="544" y2="70" className="stroke-line" />

        {/* Sidebar */}
        <rect x="24" y="70" width="122" height="320" className="fill-canvas" />
        <line x1="146" y1="70" x2="146" y2="390" className="stroke-line" />
        <rect x="40" y="88" width="22" height="22" rx="6" className="fill-brand" />
        <path d="M45.5 104.5l5.5-11 5.5 11h-3.6l-1.9-3.8-1.9 3.8z" className="fill-on-brand" />
        <rect x="70" y="94" width="54" height="9" rx="4.5" className="fill-ink opacity-80" />
        <rect x="34" y="124" width="102" height="26" rx="7" className="fill-brand-soft" />
        <rect x="46" y="133" width="52" height="8" rx="4" className="fill-brand" />
        <rect x="46" y="165" width="44" height="8" rx="4" className="fill-ink-soft opacity-40" />
        <rect x="46" y="193" width="58" height="8" rx="4" className="fill-ink-soft opacity-40" />
        <rect x="46" y="221" width="40" height="8" rx="4" className="fill-ink-soft opacity-40" />

        {/* Header */}
        <rect x="166" y="92" width="150" height="14" rx="6" className="fill-ink opacity-90" />
        <rect x="166" y="114" width="210" height="8" rx="4" className="fill-ink-soft opacity-40" />
        <rect x="446" y="90" width="78" height="28" rx="8" className="fill-brand" />
        <rect x="462" y="101" width="46" height="6" rx="3" className="fill-on-brand" />

        {/* Stat cards */}
        {[166, 286, 406].map((x, i) => (
          <g key={x}>
            <rect x={x} y="140" width="112" height="72" rx="10" className="fill-paper stroke-line" />
            <rect x={x + 14} y="154" width={[46, 34, 28][i]} height="6" rx="3" className="fill-ink-soft opacity-50" />
            <text x={x + 14} y="196" fontSize="26" fontWeight="700" className="fill-ink">{['6', '2', 'Pro'][i]}</text>
          </g>
        ))}
        <rect x="470" y="178" width="40" height="16" rx="8" className="fill-ok/15" />
        <rect x="480" y="183" width="20" height="6" rx="3" className="fill-ok" />

        {/* List */}
        <rect x="166" y="228" width="352" height="148" rx="10" className="fill-paper stroke-line" />
        {rows.map((r, i) => {
          const y = 228 + i * 37;
          return (
            <g key={i}>
              {i > 0 ? <line x1="166" y1={y} x2="518" y2={y} className="stroke-line" /> : null}
              <rect x="182" y={y + 15} width={r.title} height="8" rx="4" className="fill-ink opacity-75" />
              <rect x="372" y={y + 16} width="44" height="6" rx="3" className="fill-ink-soft opacity-40" />
              <rect x="432" y={y + 10} width="68" height="18" rx="9" className={pill[r.status].box} />
              <rect x="446" y={y + 16} width="40" height="6" rx="3" className={pill[r.status].bar} />
            </g>
          );
        })}
      </g>
      <rect x="24" y="30" width="520" height="360" rx="18" className="fill-none stroke-line" />

      {/* Floating card: due this week */}
      <g className="drop-shadow-xl">
        <rect x="420" y="312" width="200" height="112" rx="14" className="fill-paper stroke-line" />
      </g>
      <rect x="438" y="328" width="70" height="7" rx="3.5" className="fill-ink-soft opacity-50" />
      <circle cx="466" cy="378" r="22" strokeWidth="7" className="fill-none stroke-line" />
      <circle cx="466" cy="378" r="22" strokeWidth="7" strokeLinecap="round" strokeDasharray="96 139" transform="rotate(-90 466 378)" className="fill-none stroke-brand" />
      <text x="466" y="384" fontSize="16" fontWeight="700" textAnchor="middle" className="fill-ink">3</text>
      <rect x="502" y="360" width="96" height="8" rx="4" className="fill-ink opacity-80" />
      <rect x="502" y="376" width="72" height="6" rx="3" className="fill-ink-soft opacity-40" />
      <rect x="502" y="390" width="50" height="16" rx="8" className="fill-brand-soft" />
      <rect x="511" y="395" width="32" height="6" rx="3" className="fill-brand" />

      {/* Floating toast: saved */}
      <g className="drop-shadow-lg">
        <rect x="6" y="330" width="176" height="46" rx="12" className="fill-ink" />
      </g>
      <circle cx="31" cy="353" r="11" className="fill-ok" />
      <path d="M26 353.5l3.4 3.4 6.6-7" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="fill-none stroke-paper" />
      <rect x="52" y="349" width="104" height="8" rx="4" className="fill-paper opacity-90" />
    </svg>
  );
}
