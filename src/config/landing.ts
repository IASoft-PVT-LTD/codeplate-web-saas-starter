// The landing page's words (src/app/(marketing)/page.tsx renders them).
// Rewrite them for the product when re-branding (docs/recipes/retheme.md):
// short, concrete, and true. Every feature listed must be something the app
// does. The headline and intro come from src/config/site.ts.
import { plans } from './plans';
import { site } from './site';

export type FeatureIcon = 'status' | 'calendar' | 'dashboard' | 'lock' | 'phone' | 'moon';

export type Quote = {
  quote: string;
  name: string;
  role: string;
  /** True while it's a made-up example: the page labels it "Placeholder". */
  placeholder: boolean;
};

export const landing = {
  hero: {
    eyebrow: 'For freelancers and small studios',
    primary: { label: 'Start free', href: '/sign-up' },
    secondary: { label: 'See pricing', href: '/pricing' },
    note: `Free for up to ${plans.free.limits.projects} ${site.resource.many}. No card needed.`,
  },

  features: {
    title: `Everything a ${site.resource.one} needs. Nothing it doesn't.`,
    body: 'The basics, done well, so your time goes into the work.',
    items: [
      { icon: 'status', title: 'Status at a glance', body: `Planned, active or done: every ${site.resource.one} shows where it stands.` },
      { icon: 'calendar', title: 'Deadlines that surface', body: 'Anything with a due date lands on your dashboard, soonest first.' },
      { icon: 'dashboard', title: "A clear view of what's next", body: "What's active, what's due and which plan you're on, on one screen." },
      { icon: 'lock', title: 'Private by default', body: `Your ${site.resource.many} are yours. Nobody else can open them, even with the link.` },
      { icon: 'phone', title: 'Works on your phone', body: "Check what's due from anywhere: every page fits a small screen." },
      { icon: 'moon', title: 'Light and dark', body: 'Follows your system setting, day or night.' },
    ] satisfies { icon: FeatureIcon; title: string; body: string }[],
  },

  // Social proof. These are PLACEHOLDERS: replace them with real quotes the
  // user has permission to publish (and set `placeholder: false`), or delete
  // the section by setting `quotes` to []. Never invent customers.
  proof: {
    title: 'What people say',
    quotes: [
      { quote: 'I stopped keeping a spreadsheet of deadlines. Everything due this week is on the first screen I see.', name: 'Jordan Example', role: 'Freelance designer', placeholder: true },
      { quote: 'Setting up took five minutes. Our three-person studio runs every client job through it now.', name: 'Priya Sample', role: 'Studio owner', placeholder: true },
      { quote: 'Simple in the right way. Status, a date and a description is all most of my work needs.', name: 'Sam Placeholder', role: 'Consultant', placeholder: true },
    ] as Quote[],
  },

  pricing: {
    title: 'Start free. Upgrade when you grow.',
    body: 'Cancel any time. Prices in USD.',
    link: { label: 'Compare plans', href: '/pricing' },
  },

  closing: {
    title: `Ready to plan your next ${site.resource.one}?`,
    body: `Sign up in a minute. Your first ${plans.free.limits.projects} ${site.resource.many} are free.`,
    button: { label: 'Start free', href: '/sign-up' },
  },
};
