export default function WorkspaceLoading() {
  return (
    <div className="workspace-route-loading" role="status" aria-live="polite">
      <div className="route-skeleton-title" />
      <div className="route-skeleton-card" />
      <div className="route-skeleton-card short" />
      <span>Se încarcă…</span>
    </div>
  );
}
