import { Badge } from './ui';

const tones = { planned: 'neutral', active: 'brand', done: 'ok' } as const;
const labels = { planned: 'Planned', active: 'Active', done: 'Done' } as const;

export function StatusBadge({ status }: { status: keyof typeof tones }) {
  return <Badge tone={tones[status]}>{labels[status]}</Badge>;
}
