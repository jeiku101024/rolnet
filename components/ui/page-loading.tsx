// Shown by each route's loading.tsx while the page reads the session and its records at request
// time, so navigations are instant under Cache Components (see app/layout.tsx).
export function PageLoading() {
  return (
    <section className="workspace" aria-busy="true">
      <p className="text-body-sm text-muted" role="status">Loading…</p>
    </section>
  );
}
