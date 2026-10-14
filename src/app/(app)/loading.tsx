// Shown inside the app's layout while a signed-in page loads its data, so a
// click answers at once. A rough outline of a page: header, cards, a list.
export default function Loading() {
  return (
    <div role="status" aria-label="Loading" className="animate-pulse motion-reduce:animate-none">
      <div className="mb-8 space-y-3">
        <div className="h-7 w-48 rounded-lg bg-line" />
        <div className="h-4 w-72 rounded bg-line" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => <div key={i} className="h-24 rounded-[var(--radius-card)] border border-line bg-paper" />)}
      </div>
      <div className="mt-10 h-48 rounded-[var(--radius-card)] border border-line bg-paper" />
    </div>
  );
}
