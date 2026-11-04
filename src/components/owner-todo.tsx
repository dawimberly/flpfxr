/** Visible placeholder for copy the owner still has to confirm. Not a claim. */
export function OwnerTodo({ items }: { items: readonly string[] }) {
  if (items.length === 0) return null;
  return (
    <aside className="mt-8 rounded-2xl border border-dashed border-border bg-surface px-5 py-4 text-sm leading-relaxed text-muted">
      <p className="font-semibold text-fg">TODO owner</p>
      <ul className="mt-2 list-disc space-y-2 pl-5">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </aside>
  );
}
