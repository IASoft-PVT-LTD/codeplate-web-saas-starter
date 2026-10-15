// The landing page. Its words live in src/config/landing.ts (and the headline
// and intro in src/config/site.ts), so a rebrand rarely touches this file.
import Link from 'next/link';
import { Badge, Card, LinkButton } from '@/components/ui';
import { FeatureIcon } from '@/components/feature-icon';
import { HeroArt } from '@/components/hero-art';
import { landing } from '@/config/landing';
import { planOrder, plans } from '@/config/plans';
import { site } from '@/config/site';

export default function Home() {
  const { hero, features, proof, pricing, closing } = landing;
  return (
    <>
      <section className="overflow-hidden">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 pt-16 pb-20 lg:grid-cols-[1fr_1.1fr] lg:pt-24">
          <div className="text-center lg:text-left">
            <p className="text-sm font-semibold uppercase tracking-wider text-brand">{hero.eyebrow}</p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl">{site.tagline}</h1>
            <p className="mx-auto mt-6 max-w-xl text-lg text-ink-soft lg:mx-0">{site.description}</p>
            <div className="mt-10 flex flex-wrap justify-center gap-3 lg:justify-start">
              <LinkButton href={hero.primary.href} className="px-6 py-3 text-base">{hero.primary.label}</LinkButton>
              <LinkButton href={hero.secondary.href} variant="secondary" className="px-6 py-3 text-base">{hero.secondary.label}</LinkButton>
            </div>
            <p className="mt-4 text-sm text-ink-soft">{hero.note}</p>
          </div>
          <HeroArt className="mx-auto max-w-xl lg:max-w-none" />
        </div>
      </section>

      <section className="border-y border-line bg-paper">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-balance">{features.title}</h2>
            <p className="mt-4 text-ink-soft">{features.body}</p>
          </div>
          <div className="mt-14 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {features.items.map((f) => (
              <div key={f.title}>
                <FeatureIcon name={f.icon} />
                <h3 className="mt-4 font-semibold">{f.title}</h3>
                <p className="mt-2 text-ink-soft">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {proof.quotes.length > 0 ? (
        <section className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-center text-3xl font-bold tracking-tight">{proof.title}</h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {proof.quotes.map((q) => (
              <Card key={q.name} className="flex flex-col">
                {q.placeholder ? <div className="mb-4"><Badge tone="warn">Placeholder</Badge></div> : null}
                <blockquote className="flex-1 text-ink">“{q.quote}”</blockquote>
                <p className="mt-6 text-sm"><span className="font-semibold">{q.name}</span> <span className="text-ink-soft">· {q.role}</span></p>
              </Card>
            ))}
          </div>
          {proof.quotes.some((q) => q.placeholder) ? (
            <p className="mt-6 text-center text-sm text-ink-soft">Sample quotes. Replace them with real ones in <code>src/config/landing.ts</code> before launch.</p>
          ) : null}
        </section>
      ) : null}

      <section className="border-t border-line bg-paper">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight">{pricing.title}</h2>
            <p className="mt-4 text-ink-soft">{pricing.body}</p>
          </div>
          <div className="mx-auto mt-12 grid max-w-4xl gap-4 sm:grid-cols-3">
            {planOrder.map((id) => (
              <Link key={id} href={pricing.link.href}
                className={`rounded-[var(--radius-card)] border bg-canvas p-5 transition hover:border-brand ${id === 'pro' ? 'border-brand' : 'border-line'}`}>
                <p className="font-semibold">{plans[id].name}</p>
                <p className="mt-2"><span className="text-3xl font-bold">{plans[id].price}</span> <span className="text-sm text-ink-soft">{plans[id].period}</span></p>
                <p className="mt-2 text-sm text-ink-soft">{plans[id].blurb}</p>
              </Link>
            ))}
          </div>
          <p className="mt-8 text-center">
            <Link href={pricing.link.href} className="font-semibold text-brand hover:underline">{pricing.link.label} →</Link>
          </p>
        </div>
      </section>

      <section className="bg-brand">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-6 py-16 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-balance text-on-brand">{closing.title}</h2>
          <p className="text-on-brand">{closing.body}</p>
          <LinkButton href={closing.button.href} variant="secondary" className="px-6 py-3 text-base">{closing.button.label}</LinkButton>
        </div>
      </section>
    </>
  );
}
